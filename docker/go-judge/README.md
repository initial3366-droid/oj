# QOJ go-judge worker

This directory builds a pinned criyle/go-judge `1.12.1` worker with the C,
C++17/20/23, Java 17 and Python 3 toolchains used by QOJ.

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

## Special Judge

The QOJ backend packages a pinned `testlib.h` and copies it into each checker
compilation sandbox. This avoids depending on files outside the Go Judge
working directory. When a problem has checker source, QOJ compiles it as C++17
and runs it in the same Go Judge isolation boundary as submissions. The checker
receives these positional arguments:

```text
input.txt output.txt answer.txt
```

Use `registerTestlibCmd(argc, argv)` and read the participant output through
`ouf`. A zero exit status accepts the case; testlib's wrong-answer and
presentation-error exit statuses reject it. Other checker failures are reported
as a system error rather than silently accepting a submission.

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

## Kernel policy hardening (2026-10-25)

The image now builds the pinned upstream module with `-tags seccomp`. The
previous release executable accepted `-seccomp-conf` but silently ignored it
when built without that tag. The image tag is `qoj-go-judge:seccomp-1.12.1`.
`qoj-entrypoint` requires the policy file and clears supplementary groups before
starting the worker. Setuid/setgid bits are removed from runtime executables.

The sandbox-level policy in `seccomp.yaml` traps ptrace, cross-process memory
access, namespace/mount manipulation, kernel module operations, BPF, keyrings,
userfaultfd, perf and io_uring. Network connection/listener calls return EPERM.
This applies to compilation, execution and special judges. It supplements the
existing namespaces, cgroup limits, read-only mounts, dropped capabilities and
upstream `NoNewPrivs` setting.

Compiler drivers and JVM threads require exec/clone. They remain permitted,
with every descendant inside the same sandbox limits. A program executing a
shell inside this boundary is not evidence of host execution. Do not filter
stdout or scan source keywords as a substitute for isolation.

Build and repeat the real worker and business API checks locally:

```bash
docker build -t qoj-go-judge:seccomp-1.12.1 docker/go-judge
python3 tools/verify-sandbox-isolation.py
```

Run those commands from the repository root. The script requires local Docker
MySQL/Redis, Python bcrypt, Maven, and an empty Redis DB15. It creates and removes
a temporary worker, backend and database, and writes
`.runtime/security-remediation/sandbox-isolation-report.json`. It verifies
`Seccomp: 2` from inside an executed program, rather than trusting flags alone.

To apply the image to a judge deployment, rebuild/recreate its worker using the
compose file above, then repeat the isolation checks on that deployment before
accepting untrusted submissions. The repository's local existing worker and
production worker are not replaced by the verification script.

Upstream implementation references (pinned versions):
- [seccomp-enabled configuration loader](https://github.com/criyle/go-judge/blob/v1.12.1/env/seccomp_linux.go)
- [configuration ignored without the build tag](https://github.com/criyle/go-judge/blob/v1.12.1/env/noseccomp_linux.go)
- [execution privilege settings](https://github.com/criyle/go-sandbox/blob/v0.13.5/container/container_exec_linux.go)
