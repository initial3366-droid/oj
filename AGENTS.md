# Repository Guidelines

## Project Structure & Module Organization

QOJ is a React/TypeScript frontend with a Spring Boot backend. Frontend source lives in `src/`: public pages in `src/pages`, admin UI in `src/admin`, teacher flows in `src/teacher`, shared components in `src/components`, API wrappers in `src/api`, and styles in `src/styles.css` plus `src/styles/`. Static assets belong in `public/`; generated output goes to `dist/`.

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

Use TypeScript React function components and keep route-level screens in `PascalCase` files such as `ContestDetailPage.tsx`. Shared helpers should live near their domain (`src/lib`, `src/utils`, or module APIs). The frontend main UI library is Ant Design 6 (`antd`; antd 6 API: `Modal open`, `Card styles.body`, `Tabs items`, `TableColumnsType`; icons from `@ant-design/icons`). Semi UI has been fully removed — do not reintroduce `@douyinfe/semi-ui` / `@douyinfe/semi-icons` imports or the `--semi-*` CSS variables (use `--qoj-*` tokens defined in `src/styles/tokens.css`). Admin (`src/admin`) and teacher (`src/teacher`) UIs use Arco (`@arco-design/web-react`). Prefer the installed library for the target area before adding dependencies.

Java packages follow `com.qoj.module.<feature>` with `controller`, `service`, `entity`, `mapper`, `dto`, and `vo` subpackages where applicable. Use 4-space indentation in Java and 2-space indentation in TypeScript/CSS.

## Testing Guidelines

Backend tests use JUnit via Spring Boot Test; name tests `*Test.java` and place them under the related package in `backend/src/test/java`. Run `mvn test` before backend changes. The frontend currently relies on `npm run build` for TypeScript validation; add focused tests for risky UI logic.

## Commit & Pull Request Guidelines

Git history is not available in this checkout, so use concise imperative messages, optionally scoped: `frontend: fix contest scoreboard filter` or `backend: validate judge queue state`. Keep commits focused and separate generated artifacts from source changes.

Pull requests should include a summary, verification commands, linked issues when relevant, and screenshots for UI changes. Call out migrations, new environment variables, security-sensitive behavior, and manual deployment steps.

## Security & Configuration Tips

Do not commit real secrets. Use `.env` locally and rotate production values such as `JWT_SECRET`, MySQL, Redis, and CCPCOJ credentials. Never enable `ENABLE_UNSAFE_LOCAL_JUDGE` in production. Add database changes as new Flyway migrations under `backend/src/main/resources/db/migration`.

## Notes

- Judge languages: go-judge + CCPCOJ support C/C++/Java/Python only; C# support was removed — do not reintroduce `csharp`/`cs` handling or `mono`/`mcs` in docker/go-judge.
- Frontend UI: all pages use antd 6 + `@ant-design/icons` (Semi UI fully removed). Use `--qoj-*` design tokens from `src/styles/tokens.css` instead of the old `--semi-*` variables.
