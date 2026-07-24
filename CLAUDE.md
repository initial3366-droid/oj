# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QOJ is a campus Online Judge platform with a React frontend and Spring Boot 3 backend. The frontend uses React 19, Vite, Arco Design + Semi UI, and Tailwind CSS v4. The backend uses Spring Boot 3.3.5 with MyBatis-Plus, Spring Security, JWT authentication, Redis caching, and Flyway migrations. Ordinary submissions use go-judge, contest submissions use the CCPCOJ pull gateway, and the host never executes user code directly.

## Development Commands

### Frontend (React + Vite)

```bash
npm install           # Install dependencies
npm run dev          # Start dev server (localhost:5173, proxies /api and /ws to backend)
npm run build        # Build for production (outputs to dist/)
npm run preview      # Preview production build
```

Requires Node.js >= 20 < 25. The Vite dev server proxies `/api` and `/ws` requests to the backend at `http://127.0.0.1:8080` (configurable via `VITE_API_PROXY_TARGET` in `.env`).

### Backend (Spring Boot 3 + Maven)

```bash
cd backend
mvn spring-boot:run  # Run backend server (port 8080)
mvn test            # Run tests
mvn clean package   # Build JAR
```

### Database Services

Start MySQL and Redis via Docker Compose:

```bash
docker compose -f .runtime/qoj-deps.compose.yml up -d
```

Services:
- MySQL 8.0 on `localhost:13306` (root password: `root`, database: `qoj`)
- Redis 7 on `localhost:16379`

Backend environment variables (see `.env` for development defaults):
- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USERNAME`, `MYSQL_PASSWORD`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- `JWT_SECRET` (minimum 64 bytes for HS512), `JWT_ACCESS_EXPIRE`, `JWT_REFRESH_EXPIRE`
- `GO_JUDGE_BASE_URL`, `GO_JUDGE_AUTH_TOKEN` (environment-only; never expose to browsers)

### Running a single backend test

```bash
cd backend
mvn test -Dtest=ContestAccessPolicyTest                     # one class
mvn test -Dtest=ContestAccessPolicyTest#methodName         # one method
```

## Architecture

### Frontend Structure

Three distinct panels, each with its own route tree and layout:

- **User panel**: `src/pages/` + `src/layouts/FrontLayout.tsx` — public-facing pages (Home, Problems, Contests, Practices, Leaderboard, etc.)
- **Admin panel**: `src/admin/` — self-contained module with its own API client (`src/admin/api/`), pages, layout, routes (`src/admin/routes/adminRoutes.tsx`), and components. Mounted at `/admin/*`.
- **Teacher panel**: `src/teacher/` — teacher-specific routes and pages. Mounted at `/teacher/*`.

Key patterns:
- **Routing**: React Router v6 with route definitions in `src/App.tsx`.
- **Data Layer**: `src/data/apiClient.ts` handles all user-panel API calls with typed responses. Admin panel has its own client under `src/admin/api/`. TypeScript interfaces for the user panel live in `src/data/types.ts` (plus `src/data/contestRankTypes.ts` for contest scoreboard shapes).
- **State Management**: `src/data/OjDataProvider.tsx` provides global state context. Auth tokens stored in `localStorage` under `qoj.accessToken`.
- **UI Library**: **Arco Design** (`@arco-design/web-react`) and **Semi UI** (`@douyinfe/semi-ui`) coexist — Arco is the primary component set, Semi is used for tables and specific widgets. Styling via **Tailwind CSS v4** (`@tailwindcss/vite`) plus layered Semi CSS overrides in `src/styles/` (`semi-base.css`, `semi-theme.css`, `semi-overrides.css`). Entry is `src/main.tsx` (imports Arco React 19 adapter, Monaco setup, Semi CSS, then `src/styles.css`); note `main.tsx.backup` is a leftover, not used.

### Backend Structure

Java package: `com.qoj`. Modular monolith with 18 domain modules under `com.qoj.module/`:

`admin`, `agent`, `announcement`, `auth`, `classroom`, `contest`, `home`, `judge`, `leaderboard`, `organization`, `practice`, `problem`, `setting`, `submission`, `teacher`, `user`, `ws`, `xcpcio`

Each module follows a consistent layered pattern: `controller/` → `service/` → `mapper/` (MyBatis-Plus) with `dto/`, `entity/`, and `vo/` classes.

Notable modules:
- **`judge`**: `GoJudgeService` owns ordinary submissions and `CcpcojJudgeGatewayService` owns contest submissions. Their scopes are fixed to prevent duplicate claims.
- **`agent`**: AI assistant (`AgentChatService`, `OpenAiCompatibleAgentClient` implementing `AgentClient`) calling an OpenAI-compatible endpoint via `java.net.http.HttpClient`; exposes chat + usage quota (`AgentQuotaVO`). Gated for users/admins via `AgentController` / `AdminAgentController`.
- **`ws`**: STOMP WebSocket endpoints bridging judge/submission/contest events to the frontend.
- **`xcpcio`**: Integration with the xcpcio toolchain (contest data sync / import).

Key architectural components:
- **`config/`**: Spring configuration — `SecurityConfig` (JWT + CORS), `WebSocketConfig` (STOMP), `MybatisPlusConfig`, `QojProperties` (externalized config from `.env`; env vars like `JUDGE_MODE` are relaxed-bound to `qoj.judge.mode`, etc.).
- **`security/`**: `JwtAuthenticationFilter` validates bearer tokens. `@CurrentUser` annotation injects the authenticated `AuthUser` into controller params. `@AdminApi` annotation + `AdminApiInterceptor` gate admin-only endpoints. `MaintenanceModeInterceptor` can disable the system globally.
- **`security/policy/`**: Dedicated access policy classes (`ContestAccessPolicy`, `PracticeAccessPolicy`, `ProblemAccessPolicy`, `ScoreboardAccessPolicy`, `SubmissionAccessPolicy`) encapsulate authorization logic — use these rather than inline checks.
- **`security/audit/`**: `AuditLogger` tracks admin operations.
- **`common/`**: Shared utilities — `ApiResponse`, `PageResult`, `ErrorCode`, Redis key constants in `RedisKeys`, enums (`ContestStatus`, `SubmissionStatus`, `UserRole`, `IdentityType`, `AudienceType`), `BizException` + `GlobalExceptionHandler`.
- **`config/SpaForwardController`**: Forwards non-API routes to `index.html` for client-side routing in production.

### API Structure

- **User API**: `/api/v1/*` (public and authenticated endpoints)
  - Auth: `/api/v1/auth/login`, `/refresh`, `/logout`, `/me`, `/register`
  - Problems: `/api/v1/problems`
  - Contests: `/api/v1/contests`
  - Submissions: `/api/v1/submissions`
  - Practices: `/api/v1/practices`
  - Home: `/api/v1/home` (daily problem, carousel, recent contests)
  - Leaderboard: `/api/v1/leaderboard/global`, `/class/{id}`, `/club/{id}`
  - Sandbox: `/api/v1/sandbox/run`
- **Admin API**: `/api/admin/v1/*` (requires admin roles via `@AdminApi`)
  - Dashboard, users, problems, contests, practices, organizations
- **Teacher API**: Teacher-specific endpoints under `/api/v1/teacher/`
- **Agent API**: `/api/v1/agent/*` (assistant chat + quota); admin agent management under `/api/admin/v1/...`
- **WebSocket**: STOMP endpoint at `/ws` for real-time judge updates
- **Swagger UI**: `http://127.0.0.1:8080/swagger-ui.html`
- **Frontend entrypoints**: User panel at `http://127.0.0.1:5173/`, admin panel at `/admin`, teacher panel at `/teacher`

### Authentication

JWT-based. Access token valid for 2 hours, refresh token for 7 days. Frontend stores tokens in `localStorage`. Backend uses Spring Security with `JwtAuthenticationFilter` that validates bearer tokens and populates `SecurityContext`. Use `@CurrentUser` to inject authenticated user in controllers.

### Database

- **Migrations**: Flyway scripts in `backend/src/main/resources/db/migration/` (V1–V47, sequential). Schema includes users, problems, test_cases, contests, contest_problems, submissions, practices, organizations (classes/clubs), leaderboards, and more. Add new migrations as `V<next N>.sql`; never edit an already-applied migration.
- **ORM**: MyBatis-Plus with mapper interfaces per entity.
- **Charset**: UTF-8MB4 collation throughout.

### Key Integration Points

- **Monaco Editor**: Code editor for submissions integrated via `@monaco-editor/react`.
- **KaTeX**: Math rendering for problem statements via `katex` library.
- **WebSocket**: Real-time submission status updates use STOMP over WebSocket at `/ws`.
- **Judging**: `GoJudgeService` sends one fixed-whitelist command per request to an authenticated private go-judge endpoint. CCPCOJ workers claim contest tasks through `/ojtool/judge`; claim ownership gates source, hidden tests and callbacks.

## Development Notes

- Frontend uses TypeScript strict mode. Type definitions are in `src/data/types.ts` and `src/data/apiClient.ts`.
- Backend uses Java 17 with Spring Boot 3 conventions. Entity classes use Lombok.
- API responses follow the format: `{ code: number, message: string, data: T }`.
- No linter (eslint/prettier) or backend formatter (checkstyle) is configured in the repo.
- Extensive Chinese-language documentation lives in `docs/` (deployment, security, API docs, database schema, WebSocket guides, refactoring reports).
