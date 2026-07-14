# QOJ CCPCOJ judge deployment

QOJ implements the pull-based HTTP protocol used by the CCPCOJ judge image. The
judge connects directly to QOJ; the CCPCOJ PHP web application and its database
are not required.

## Login and problem management

This deployment intentionally has no CCPCOJ web login page. It runs only the
privileged CCPCOJ judge worker, which signs in to QOJ's private worker endpoint
automatically with `CCPCOJ_JUDGE_USERNAME` and `CCPCOJ_JUDGE_PASSWORD`. Operators
must not open `/ojtool/judge` in a browser or expose it as a public login page.

Administrators manage all problems in QOJ instead:

1. Sign in at `https://QOJ_HOST/admin/login`.
2. Open **题目管理 → 添加题目** and save the statement and limits.
3. In the test-case step, upload a ZIP whose files are paired as `1.in` /
   `1.out`, `2.in` / `2.out`, and so on. The importer rejects traversal paths,
   oversized archives, and unmatched pairs.
4. Open **比赛管理 → 创建比赛**, select the existing QOJ problems, and choose
   **CCPCOJ** as the judge service for a large contest. QOJ creates immutable
   contest problem snapshots; no second import into CCPCOJ is needed.

The administrator credentials for QOJ and the judge-worker credentials are
different accounts. Judge credentials are machine-only and cannot be used at
the QOJ administrator login page.

## Configure QOJ

QOJ fixes ordinary problem and practice submissions to go-judge, while contest
submissions are owned by CCPCOJ. Open the administrator judge settings page and
configure:

- judge username
- a strong judge password

The configured username identifies the standard ACM contest worker. An OI
worker uses the same password and appends `-oi` to that username. For example,
`judger` and `judger-oi` are routed to different queues.

The worker protocol is served at:

```text
https://QOJ_HOST/ojtool/judge
```

## Start a worker

```bash
cd docker/ccpcoj
umask 077
cp .env.example .env
# Replace CCPCOJ_IMAGE with a tested immutable tag or registry digest.
docker compose up -d
```

The username and password in `.env` must match the values saved in QOJ. On a
Linux host where `host.docker.internal` is unavailable, set `QOJ_BASE_URL` to a
reachable private address of the QOJ backend.

Changing the configured judge username or password immediately invalidates all
existing worker cookies. Workers must log in again before receiving any source
code or hidden test data.

CCPCOJ uses one global ACM/OI switch per worker. Keep `CCPCOJ_OI_MODE=0` and the
base username for ACM contest judging. For partial-score OI
judging, start a second Compose project with `CCPCOJ_OI_MODE=1` and append
`-oi` to `CCPCOJ_JUDGE_USERNAME`:

```bash
docker compose -p qoj-ccpcoj-acm up -d
docker compose -p qoj-ccpcoj-oi --env-file .env.oi up -d
```

Use only letters, numbers, `.`, `_`, `~`, and `-` in the judge password. The
upstream worker sends credentials through a shell-built form request and does
not safely encode spaces or shell metacharacters. `CCPCOJ_IMAGE` is mandatory;
pin it to a tested immutable image tag or digest before Compose can start.

## Security

The upstream judge container requires privileged Linux capabilities. Run it on
a dedicated judge host, keep the QOJ gateway on a private TLS-protected network,
and restrict `/ojtool/judge` at the reverse proxy or firewall to judge-host IPs.
Never expose the judge password in source control or application logs.

The container image is provided by the
[CSGrandeur/CCPCOJ](https://github.com/CSGrandeur/CCPCOJ) project under GPL-3.0.
