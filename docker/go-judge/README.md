# QOJ go-judge worker

This directory builds a pinned criyle/go-judge `1.12.1` worker with the C,
C++, Java 17 and Python 3 toolchains used by QOJ.

## Start

```bash
cd docker/go-judge
umask 077
cp .env.example .env
# Replace GO_JUDGE_AUTH_TOKEN before starting.
docker compose up -d --build
```

Set the same token in the backend environment:

```bash
GO_JUDGE_BASE_URL=http://127.0.0.1:15050
GO_JUDGE_AUTH_TOKEN=<same-random-token>
```

## Security boundary

- Port `5050` is published only on host loopback; never bind it to `0.0.0.0`.
- Execution and cache endpoints require a bearer token and are called only by
  the Spring backend. Upstream leaves `/version` public, so the worker must stay
  bound to loopback or an equally restrictive private network.
- Request logging is disabled because the authentication token is a process
  argument. Restrict Docker socket access: Docker administrators can inspect it.
- `-no-fallback` stops the service if cgroup isolation cannot be created.
- The default 2 GiB container runs one sandbox at a time. Raise memory and host
  capacity before increasing `GO_JUDGE_PARALLELISM`.
- User commands, environment variables and file names are selected by the backend
  allowlist. Source and test data are supplied only as in-memory file content.
- The worker container needs elevated cgroup/mount privileges. For production,
  run it on a dedicated judge host or VM with firewall rules allowing only the
  application backend. Do not colocate it with database credentials or backups.
- Rotate the token if it appears in logs or shell history, and restart both the
  worker and backend after rotation.
