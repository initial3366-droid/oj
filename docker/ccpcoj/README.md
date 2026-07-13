# QOJ CCPCOJ judge deployment

QOJ implements the pull-based HTTP protocol used by the CCPCOJ judge image. The
judge connects directly to QOJ; the CCPCOJ PHP web application and its database
are not required.

## Configure QOJ

Open the administrator judge settings page and configure:

- judge mode or contest judge mode: `CCPCOJ`
- judge username
- a strong judge password

The configured username identifies the standard ACM/practice worker. An OI
worker uses the same password and appends `-oi` to that username. For example,
`judger` and `judger-oi` are routed to different queues.

The worker protocol is served at:

```text
http://QOJ_HOST:18080/ojtool/judge
```

## Start a worker

```bash
cd docker/ccpcoj
cp .env.example .env
docker compose up -d
```

The username and password in `.env` must match the values saved in QOJ. On a
Linux host where `host.docker.internal` is unavailable, set `QOJ_BASE_URL` to a
reachable private address of the QOJ backend.

CCPCOJ uses one global ACM/OI switch per worker. Keep `CCPCOJ_OI_MODE=0` and the
base username for ACM and ordinary practice judging. For partial-score OI
judging, start a second Compose project with `CCPCOJ_OI_MODE=1` and append
`-oi` to `CCPCOJ_JUDGE_USERNAME`:

```bash
docker compose -p qoj-ccpcoj-acm up -d
docker compose -p qoj-ccpcoj-oi --env-file .env.oi up -d
```

Use only letters, numbers, `.`, `_`, `~`, and `-` in the judge password. The
upstream worker sends credentials through a shell-built form request and does
not safely encode spaces or shell metacharacters. Pin `CCPCOJ_VERSION` to a
tested image tag for production deployments.

## Security

The upstream judge container requires privileged Linux capabilities. Run it on
a dedicated judge host, restrict access to the QOJ backend, and never expose the
judge password in source control.

The container image is provided by the
[CSGrandeur/CCPCOJ](https://github.com/CSGrandeur/CCPCOJ) project under GPL-3.0.
