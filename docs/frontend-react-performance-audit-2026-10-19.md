# Frontend Runtime and Component Performance Audit

Date: 2026-10-19

## React Audit

No React runtime was found in the root dependency lockfile, installed dependency
tree, application and upstream Vue source imports, or modules included in the
production build. No JSX/TSX files exist under `src/`. Vue's `reactive` and
`@vue/reactivity` are unrelated to React. Archived deployment bundles and ZIP
files are outside this audit's scope.

`tools/audit-frontend-runtime.mjs` records dependency matches, source import
matches and the actual modules, raw sizes and gzip sizes of every production
chunk. It exits unsuccessfully if React is detected. Reports are stored under
`.runtime/frontend-performance/{before,after}/build-audit.json`.

## Changes

- Resolve Element Plus components and directives on demand instead of registering
  the entire plugin. Preserve the existing complete stylesheet and configure
  Chinese locale through `ElConfigProvider`. Preserve global icon registration
  required by upstream dynamic navigation icons.
- Load Monaco when `CodeEditor` mounts, so closed code dialogs do not force list
  pages to download and evaluate Monaco. Read current props after the async load;
  cancel initialization after unmount and display a message on load failure.
- Dispose the editor's owned text model when the component unmounts.
- Render formulas when sanitized content or the host element changes, instead of
  scanning the DOM after every component update.

No upstream template, stylesheet, icon or asset was modified.

## Measured Results

Production Vite preview, Chromium, 4x CPU slowdown, fresh browser context for each
run, local mocked API responses, three runs per viewport. Times are medians;
list-ready means the populated list's view-code button is available, measured
from navigation. JavaScript bytes are decoded response sizes, not network sizes.
These measurements isolate frontend work and do not measure backend latency.

| Metric | Before | After |
| --- | ---: | ---: |
| Main JS chunk | 1,525,546 B | 897,119 B |
| Main JS chunk, gzip | 493,501 B | 294,187 B |
| List initial JS, all chunks | 5,586,479 B | 1,131,208 B |
| Monaco JS before opening code | 4,043,482 B | 0 B |
| List ready, desktop 1440x1000 | 1,869 ms | 805 ms |
| List ready, mobile 390x844 | 1,803 ms | 756 ms |
| Initial long-task total, desktop | 704 ms | 403 ms |
| Initial long-task total, mobile | 651 ms | 363 ms |
| First code dialog, desktop | 311 ms | 861 ms |
| First code dialog, mobile | 320 ms | 885 ms |

Initial JS is reduced by 79.8%; list-ready time is reduced by 57.0% on desktop
and 58.1% on mobile. Deferred loading shifts approximately 0.6 seconds to the
first code-dialog opening in this environment; Monaco remains cached afterward.
This is a loading and resource-lifecycle optimization, not a claim that all
component interactions became faster.

## Verification and Artifacts

- `npm run build`: passed, including Vue and TypeScript checks.
- `npm run verify:template`: passed, 143 original template/style checks and 396
  files; the existing seven approved script adaptations remain intact.
- Performance E2E: desktop/mobile, three runs each, no React modules or premature
  Monaco requests, code rendering and navigation back to the list passed.
  On desktop, inspecting the loaded Monaco module confirms one active model
  while viewing code and zero after leaving the page.
- Management E2E: nine selected admin/teacher pages at 1440, 1024 and 390 pixels,
  all 27 checks passed. See `.runtime/frontend-performance/management/report.json`
  and its screenshots and trace.
- Sample-selection E2E: large sample switching, sandbox request/output and custom
  input reset passed. See `.runtime/sample-select-performance/before.json` and
  `before-trace.zip` generated in this audit.
- Admin and teacher problem preview E2E: HTML, three formulas, plaintext
  whitespace and unsafe-HTML removal passed. See
  `.runtime/problem-preview-samples/report.json` and `trace.zip`.

Performance raw results, screenshots and Playwright traces are in
`.runtime/frontend-performance/{before,after}/`.

## Repeat

Use the same machine without other active browser tests for timing comparisons.
Set `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` to local installations if the script's
existing project-environment defaults are unavailable.

```sh
npm run build
npm run verify:template
npm run audit:frontend
npm run preview -- --port 5186 --strictPort
```

In another terminal, with the preview still running:

```sh
PERFORMANCE_EXPECT_LAZY=1 npm run test:e2e:performance
LAYOUT_BASE_URL=http://127.0.0.1:5186 node tools/verify-problem-preview-samples.mjs
LAYOUT_BASE_URL=http://127.0.0.1:5186 PERF_PHASE=verified node tools/verify-sample-select-performance.mjs
LAYOUT_BASE_URL=http://127.0.0.1:5186 PLAYWRIGHT_MODULE=/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs MANAGEMENT_PATHS=/auth_ac/dashboard,/auth_ac/problems,/auth_ac/problems/1/edit,/auth_ac/settings/system,/auth_ac/ai/settings,/auth_ac/profile,/teacher/submissions,/teacher/students,/teacher/courses MANAGEMENT_OUTPUT=.runtime/frontend-performance/management node tools/verify-management-pages.mjs
```

The default audit/report output is `.runtime/frontend-performance/after`; use
`AUDIT_OUTPUT` to retain another run. Set `LAYOUT_BASE_URL` when using another
preview port. Baseline results are retained for comparison; reproducing the
baseline requires the source state before these changes.
