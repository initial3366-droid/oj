# Repository Guidelines

## Project Structure & Module Organization

QOJ uses Vue 3 and TypeScript with a Spring Boot backend. Vue Router owns every public, admin, teacher, and shared UI route; React and its UI dependencies have been removed. The entry is `src/main.ts`, with application assembly under `src/vue/main.ts`. All UI belongs in `src/vue/`; all three portals share `src/vue/layouts/components/ManagementShell.vue`, which adapts QOJ data to the original template under `vendor/vue3-element-admin`. API wrappers stay in `src/api`; framework-neutral helpers remain under their existing modules. Shared styles and tokens remain in `src/styles/`; public page CSS under `src/pages` and `src/layouts` is still imported by Vue. Static assets belong in `public/`; generated output goes to `dist/`.

Backend code is under `backend/src/main/java/com/qoj`, organized by modules such as `contest`, `problem`, `submission`, and `judge`. Resources and Flyway migrations live in `backend/src/main/resources`; tests are in `backend/src/test/java`. Operational docs are in `docs/`; deployment bundles and backups are archival.

## Build, Test, and Development Commands

- `npm install`: install frontend dependencies; use Node `>=20 <25`.
- `npm run dev`: start Vite on `0.0.0.0`, usually served at `http://127.0.0.1:5173`.
- `npm run build`: run TypeScript project build and produce `dist/`.
- `npm run preview`: preview the built frontend.
- `docker compose -f .runtime/qoj-deps.compose.yml up -d`: start local MySQL/Redis dependencies.
- `cd backend && mvn spring-boot:run`: run the backend API.
- `cd backend && mvn test`: run Java unit and policy tests.
- `./node_modules/.bin/tsc --noEmit -p tsconfig.json`: frontend type check (same as the `tsc -b` step of `npm run build`).

## Coding Style & Naming Conventions

Write new and migrated frontend UI as Vue 3 single-file components with `<script setup lang="ts">` under `src/vue/`. Use Vue Router, Pinia, Element Plus, and `@element-plus/icons-vue`, following the Vue 3 + Vite + TypeScript structure from `https://gitee.com/youlaiorg/vue3-element-admin` while retaining QOJ's API contracts and route behavior. Directly reuse upstream UI from `vendor/vue3-element-admin`; do not reimplement or restyle equivalent template components. Keep upstream templates, styles, icons and assets unchanged. QOJ interface adaptations belong under `src/vue/template-adapter`; any unavoidable upstream script adaptation must be documented in `vendor/vue3-element-admin.upstream.json`. Run `npm run verify:template` to verify integrity. Keep shared helpers framework-neutral where possible. Do not reintroduce React or a second frontend runtime. Use the `--qoj-*` tokens from `src/styles/tokens.css` where applicable. Do not add Semi UI or the removed `--semi-*` variables.

Java packages follow `com.qoj.module.<feature>` with `controller`, `service`, `entity`, `mapper`, `dto`, and `vo` subpackages where applicable. Use 4-space indentation in Java and 2-space indentation in TypeScript/CSS.

## Testing Guidelines

Backend tests use JUnit via Spring Boot Test; name tests `*Test.java` and place them under the related package in `backend/src/test/java`. Run `mvn test` before backend changes. For frontend behavior, prefer E2E flows as the testing mechanism and produce repeatable reports, traces, or screenshots as artifacts; do not add unit tests for the Vue migration. `npm run build` includes TypeScript and Vue SFC type checking.

## Commit & Pull Request Guidelines

Git history is not available in this checkout, so use concise imperative messages, optionally scoped: `frontend: fix contest scoreboard filter` or `backend: validate judge queue state`. Keep commits focused and separate generated artifacts from source changes.

Pull requests should include a summary, verification commands, linked issues when relevant, and screenshots for UI changes. Call out migrations, new environment variables, security-sensitive behavior, and manual deployment steps.

## Security & Configuration Tips

Do not commit real secrets. Use `.env` locally and rotate production values such as `JWT_SECRET`, MySQL, Redis, and go-judge credentials. Never enable `ENABLE_UNSAFE_LOCAL_JUDGE` in production. Add database changes as new Flyway migrations under `backend/src/main/resources/db/migration`.

## Notes

- Judge languages: go-judge supports C/C++/Java/Python only; C# support was removed — do not reintroduce `csharp`/`cs` handling or `mono`/`mcs` in docker/go-judge.
- Frontend UI: new and migrated Vue pages use Element Plus and `@element-plus/icons-vue`; all routes use the Vue runtime. Use `--qoj-*` design tokens from `src/styles/tokens.css` where applicable; do not reintroduce Semi UI or `--semi-*` variables.
