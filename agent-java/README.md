# QOJ Java Agent

This Spring Boot 4 service is the active AI problem-generation service in Compose. It keeps the existing isolated service boundary, `/healthz`, `/v1/problem/generate`, `/v1/problem/draft`, QOJ draft APIs, PowerShell skill runner, SSE event names, and workspace volume. Administrator and teacher JWTs are checked through QOJ's internal endpoint.

Provider settings are loaded from the QOJ internal config endpoint on each generation request. The Agent does not receive the provider key through the browser or container environment. The shared internal token is server-side only; users authenticate with their normal QOJ administrator or teacher JWT.

Run locally with Java 17, PowerShell 7, and the ICPC Problem Creator skill mounted:

```sh
mvn spring-boot:run
```

Required environment for the container deployment:

- `QOJ_BASE_URL` and `AGENT_INTERNAL_TOKEN` to load the current model settings from QOJ.
- A valid QOJ administrator or teacher JWT is required by the Agent API; the Agent checks it through QOJ's internal authorization endpoint.
- `ICPC_SKILL_ROOT` mounted read-only at `/opt/icpc-problem-creator`.
- `AGENT_WORKSPACE_ROOT` mounted as a writable persistent volume.
