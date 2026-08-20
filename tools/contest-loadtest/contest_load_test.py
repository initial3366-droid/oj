#!/usr/bin/env python3
"""QOJ contest load test.

This script models one authenticated browser user per account.  It is deliberately
opt-in: without ``--execute --confirm-online`` it only validates local inputs and
does not contact the target site or the proxy provider.

The normal scenario is:

1. Fetch a proxy pool in batches (the supplied provider endpoint normally returns
   ten lines per request).
2. Log in all users through the assigned proxies.
3. Optionally register them for the contest.
4. Release all ready users at one barrier and submit one source file each.
5. Optionally poll submissions until they reach a final status.
6. Write a JSON report and a small HTML report without tokens or passwords.

One submission per user is intentional.  QOJ protects a user's pending
submission with a short Redis key and also limits a user to ten submissions per
minute.  Retrying a 429 or a transport timeout automatically could turn a test
failure into duplicate submissions, so submissions are never retried here.

Dependency: aiohttp (see requirements.txt).
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import hashlib
import html
import json
import os
import random
import re
import sys
import time
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any, Iterable
from urllib.parse import parse_qs, quote, urlencode, urlsplit, urlunsplit

try:
    import aiohttp
except ImportError as exc:  # pragma: no cover - exercised by users without deps
    raise SystemExit(
        "缺少 aiohttp，请先执行：python3 -m pip install -r tools/contest-loadtest/requirements.txt"
    ) from exc


RUNNING_STATUSES = {
    "WAITING",
    "PENDING",
    "QUEUED",
    "REJUDGE_PENDING",
    "JUDGING",
    "COMPILING",
    "RUNNING",
}

DEFAULT_CODE = {
    "c": "#include <stdio.h>\nint main(void) { return 0; }\n",
    "cpp": "#include <iostream>\nint main() { return 0; }\n",
    "python": "import sys\n\nif __name__ == '__main__':\n    pass\n",
    "java": "public class Main { public static void main(String[] args) {} }\n",
}


@dataclass(frozen=True)
class Account:
    username: str
    password: str


@dataclass(frozen=True)
class ProxyAssignment:
    proxy_id: str
    url: str | None


@dataclass
class RequestRecord:
    phase: str
    user_index: int | None
    account: str | None
    method: str
    path: str
    proxy_id: str
    http_status: int | None
    api_code: int | None
    ok: bool
    elapsed_ms: float
    message: str


@dataclass
class ApiResult:
    ok: bool
    http_status: int | None
    api_code: int | None
    message: str
    data: Any
    elapsed_ms: float


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def mask_username(value: str) -> str:
    if len(value) <= 2:
        return "*" * len(value)
    return f"{value[:1]}***{value[-1:]}"


def short_message(value: Any, limit: int = 240) -> str:
    text = str(value or "").replace("\r", " ").replace("\n", " ").strip()
    return text if len(text) <= limit else text[: limit - 1] + "…"


def percentile(values: Iterable[float], percent: float) -> float | None:
    ordered = sorted(values)
    if not ordered:
        return None
    if len(ordered) == 1:
        return round(ordered[0], 2)
    position = (len(ordered) - 1) * percent / 100
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    fraction = position - lower
    result = ordered[lower] + (ordered[upper] - ordered[lower]) * fraction
    return round(result, 2)


def load_env_file(path: str | None) -> None:
    """Load a small KEY=VALUE file without overwriting real environment vars."""
    if not path:
        return
    env_path = Path(path)
    if not env_path.exists():
        raise SystemExit(f"env 文件不存在：{env_path}")
    for line_number, raw_line in enumerate(env_path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'\"")
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
            raise SystemExit(f"env 文件第 {line_number} 行的变量名无效：{key}")
        os.environ.setdefault(key, value)


def normalize_base_url(value: str) -> str:
    base = value.strip().rstrip("/")
    if not base.startswith(("http://", "https://")):
        raise SystemExit("--base-url 必须以 http:// 或 https:// 开头")
    return base


def normalize_proxy(raw: str) -> str | None:
    value = raw.strip().strip('"\'')
    if not value:
        return None
    # Some proxy providers return ip:port:username:password when
    # returnAccount=2 is enabled. Convert it to a standard proxy URL.
    if not value.startswith(("http://", "https://")) and "@" not in value:
        parts = value.split(":", 3)
        if len(parts) == 4 and parts[1].isdigit():
            host, port, username, password = parts
            value = f"http://{quote(username, safe='')}:{quote(password, safe='')}@{host}:{port}"
    if not value.startswith(("http://", "https://")):
        value = "http://" + value
    parsed = urlsplit(value)
    try:
        port = parsed.port
    except ValueError:
        return None
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or port is None:
        return None
    return value


def parse_proxy_text(text: str) -> list[str]:
    """Parse txt output and a few common JSON proxy-pool responses."""
    candidates: list[str] = []
    stripped = text.strip()
    if stripped.startswith(("[", "{")):
        try:
            payload = json.loads(stripped)

            def walk(value: Any) -> None:
                if isinstance(value, str):
                    candidates.append(value)
                elif isinstance(value, list):
                    for item in value:
                        walk(item)
                elif isinstance(value, dict):
                    for item in value.values():
                        walk(item)

            walk(payload)
        except json.JSONDecodeError:
            pass
    if not candidates:
        candidates.extend(re.split(r"[\s,]+", stripped))

    result: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        normalized = normalize_proxy(candidate)
        if normalized and normalized not in seen:
            seen.add(normalized)
            result.append(normalized)
    return result


def with_count(url: str, count: int) -> str:
    parsed = urlsplit(url)
    query = parse_qs(parsed.query, keep_blank_values=True)
    query["count"] = [str(count)]
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query, doseq=True), parsed.fragment))


def read_accounts(path: str, users: int) -> list[Account]:
    account_path = Path(path)
    if not account_path.exists():
        raise SystemExit(f"账号文件不存在：{account_path}")
    with account_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames or "username" not in reader.fieldnames or "password" not in reader.fieldnames:
            raise SystemExit("账号 CSV 必须包含 username,password 表头")
        accounts = []
        seen = set()
        for row in reader:
            username = (row.get("username") or "").strip()
            password = row.get("password") or ""
            if not username or not password:
                continue
            if username in seen:
                raise SystemExit(f"账号 CSV 存在重复用户名：{username}")
            seen.add(username)
            accounts.append(Account(username, password))
    if len(accounts) < users:
        raise SystemExit(f"需要 {users} 个账号，但 CSV 只有 {len(accounts)} 个有效账号")
    return accounts[:users]


def load_code(path: str | None, language: str) -> str:
    if path:
        source = Path(path).read_text(encoding="utf-8")
        if not source.strip():
            raise SystemExit("代码文件不能为空")
        return source
    return DEFAULT_CODE[language]


async def fetch_proxy_pool(url: str, users: int, batch_size: int, delay: float) -> list[str]:
    timeout = aiohttp.ClientTimeout(total=30)
    connector = aiohttp.TCPConnector(limit=4)
    proxies: list[str] = []
    seen: set[str] = set()
    calls = 0
    max_calls = max(1, (users + batch_size - 1) // batch_size)
    async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
        while len(proxies) < users and calls < max_calls:
            calls += 1
            request_url = with_count(url, min(batch_size, users - len(proxies)))
            try:
                async with session.get(request_url) as response:
                    body = await response.text(errors="replace")
                    if response.status >= 400:
                        raise RuntimeError(f"代理接口 HTTP {response.status}")
            except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
                raise SystemExit(f"代理接口请求失败（第 {calls} 次）：{exc}") from exc
            for proxy in parse_proxy_text(body):
                if proxy not in seen:
                    seen.add(proxy)
                    proxies.append(proxy)
            if len(proxies) < users and delay > 0:
                await asyncio.sleep(delay)
    return proxies


def assignment_pool(proxy_urls: list[str], users: int, allow_direct: bool) -> list[ProxyAssignment]:
    if not proxy_urls:
        if not allow_direct:
            raise SystemExit("没有可用代理；如需直连测试，请显式添加 --allow-direct")
        return [ProxyAssignment("direct", None) for _ in range(users)]
    return [
        ProxyAssignment(f"proxy-{index % len(proxy_urls) + 1:03d}", proxy_urls[index % len(proxy_urls)])
        for index in range(users)
    ]


class QojLoadClient:
    def __init__(self, base_url: str, users: int, timeout_seconds: float, poll_concurrency: int):
        self.base_url = base_url
        self.timeout = aiohttp.ClientTimeout(total=timeout_seconds)
        self.request_limit = asyncio.Semaphore(max(users, 1))
        self.poll_limit = asyncio.Semaphore(max(poll_concurrency, 1))
        self.proxy_limits: dict[str, asyncio.Semaphore] = {}
        self.records: list[RequestRecord] = []
        self.session: aiohttp.ClientSession | None = None

    async def __aenter__(self) -> "QojLoadClient":
        connector = aiohttp.TCPConnector(limit=0, ttl_dns_cache=300)
        self.session = aiohttp.ClientSession(
            connector=connector,
            timeout=self.timeout,
            cookie_jar=aiohttp.DummyCookieJar(),
            headers={"Accept": "application/json"},
        )
        return self

    async def __aexit__(self, *_: Any) -> None:
        if self.session:
            await self.session.close()

    async def request(
        self,
        phase: str,
        user_index: int | None,
        account: str | None,
        assignment: ProxyAssignment,
        method: str,
        path: str,
        token: str | None = None,
        payload: dict[str, Any] | None = None,
    ) -> ApiResult:
        if self.session is None:
            raise RuntimeError("HTTP client 尚未启动")
        headers: dict[str, str] = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        url = f"{self.base_url}{path}"
        proxy_limit = self.proxy_limits.setdefault(assignment.proxy_id, asyncio.Semaphore(10))
        phase_limit = self.poll_limit if phase == "poll" else self.request_limit
        started = time.perf_counter()
        http_status: int | None = None
        api_code: int | None = None
        message = ""
        data: Any = None
        ok = False
        try:
            async with phase_limit, proxy_limit:
                async with self.session.request(
                    method,
                    url,
                    json=payload,
                    headers=headers,
                    proxy=assignment.url,
                    allow_redirects=False,
                ) as response:
                    http_status = response.status
                    raw = await response.text(errors="replace")
                    try:
                        body = json.loads(raw) if raw else {}
                    except json.JSONDecodeError:
                        body = {}
                    if isinstance(body, dict):
                        raw_code = body.get("code")
                        try:
                            api_code = int(raw_code) if raw_code is not None else None
                        except (TypeError, ValueError):
                            api_code = None
                        message = short_message(body.get("message") or body.get("error") or "")
                        data = body.get("data")
                    else:
                        message = short_message(raw)
                    ok = 200 <= http_status < 400 and (api_code is None or api_code == 200)
                    if not ok and not message:
                        message = f"HTTP {http_status}"
        except (aiohttp.ClientError, asyncio.TimeoutError, OSError) as exc:
            message = short_message(exc)
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        self.records.append(RequestRecord(
            phase=phase,
            user_index=user_index,
            account=mask_username(account) if account else None,
            method=method,
            path=path,
            proxy_id=assignment.proxy_id,
            http_status=http_status,
            api_code=api_code,
            ok=ok,
            elapsed_ms=elapsed_ms,
            message=message,
        ))
        return ApiResult(ok, http_status, api_code, message, data, elapsed_ms)


def token_from_login(result: ApiResult) -> str | None:
    if not isinstance(result.data, dict):
        return None
    if result.data.get("portal") not in (None, "USER"):
        return None
    token = result.data.get("accessToken")
    return token if isinstance(token, str) and token else None


def final_status(value: Any) -> bool:
    status = str(value or "").upper()
    return bool(status) and status not in RUNNING_STATUSES


async def prepare_user(
    client: QojLoadClient,
    index: int,
    account: Account,
    assignment: ProxyAssignment,
    args: argparse.Namespace,
) -> dict[str, Any]:
    outcome: dict[str, Any] = {
        "index": index + 1,
        "account": mask_username(account.username),
        "proxyId": assignment.proxy_id,
        "ready": False,
        "login": None,
        "registration": None,
        "submission": None,
        "finalStatus": None,
        "_username": account.username,
    }
    login = await client.request(
        "login", index + 1, account.username, assignment, "POST", "/api/v1/auth/login",
        payload={"username": account.username, "password": account.password},
    )
    outcome["login"] = {"ok": login.ok, "httpStatus": login.http_status, "elapsedMs": login.elapsed_ms, "message": login.message}
    token = token_from_login(login) if login.ok else None
    if not token:
        outcome["error"] = "登录失败或返回的不是普通用户令牌"
        return outcome

    if args.register:
        registration_payload: dict[str, Any] = {"identityType": "PERSONAL", "starred": False}
        if args.registration_password:
            registration_payload["password"] = args.registration_password
        registration = await client.request(
            "register", index + 1, account.username, assignment, "POST",
            f"/api/v1/contests/{args.contest_id}/register", token=token, payload=registration_payload,
        )
        outcome["registration"] = {
            "ok": registration.ok,
            "httpStatus": registration.http_status,
            "elapsedMs": registration.elapsed_ms,
            "message": registration.message,
        }
        if not registration.ok:
            outcome["error"] = "报名失败"
            return outcome

    outcome["ready"] = True
    outcome["_token"] = token
    return outcome


async def submit_user(
    client: QojLoadClient,
    outcome: dict[str, Any],
    assignment: ProxyAssignment,
    args: argparse.Namespace,
    source: str,
    release: asyncio.Event,
) -> None:
    await release.wait()
    index = int(outcome["index"]) - 1
    if args.ramp_up_seconds > 0:
        await asyncio.sleep(args.ramp_up_seconds * index / max(args.users - 1, 1))
    if args.submit_jitter_ms > 0:
        await asyncio.sleep(random.uniform(0, args.submit_jitter_ms) / 1000)

    submit = await client.request(
        "submit", index + 1, outcome["_username"], assignment, "POST", "/api/v1/submissions",
        token=outcome["_token"],
        payload={
            "problemId": args.problem_id,
            "contestId": args.contest_id,
            "code": source,
            "language": args.language,
        },
    )
    submission_info: dict[str, Any] = {
        "ok": submit.ok,
        "httpStatus": submit.http_status,
        "elapsedMs": submit.elapsed_ms,
        "message": submit.message,
    }
    submission_id: int | None = None
    if isinstance(submit.data, dict):
        raw_id = submit.data.get("id")
        if isinstance(raw_id, int):
            submission_id = raw_id
        elif isinstance(raw_id, str) and raw_id.isdigit():
            submission_id = int(raw_id)
        submission_info["id"] = submission_id
        submission_info["status"] = submit.data.get("status")
    outcome["submission"] = submission_info

    if not args.wait_for_results or not submit.ok or submission_id is None:
        outcome.pop("_token", None)
        return

    deadline = time.monotonic() + args.result_timeout_seconds
    last_status: str | None = None
    while time.monotonic() < deadline:
        result = await client.request(
            "poll", index + 1, outcome["_username"], assignment, "GET",
            f"/api/v1/submissions/{submission_id}", token=outcome["_token"],
        )
        if isinstance(result.data, dict):
            last_status = str(result.data.get("status") or "")
            outcome["finalStatus"] = last_status or None
            if final_status(last_status):
                break
        await asyncio.sleep(args.poll_interval_seconds)
    if outcome["finalStatus"] is None and last_status:
        outcome["finalStatus"] = last_status
    outcome.pop("_token", None)


def phase_summary(records: list[RequestRecord]) -> dict[str, Any]:
    grouped: dict[str, list[RequestRecord]] = defaultdict(list)
    for record in records:
        grouped[record.phase].append(record)
    summary: dict[str, Any] = {}
    for phase, items in sorted(grouped.items()):
        latencies = [item.elapsed_ms for item in items]
        status_counts = Counter(str(item.http_status or "transport_error") for item in items)
        summary[phase] = {
            "requests": len(items),
            "ok": sum(item.ok for item in items),
            "failed": sum(not item.ok for item in items),
            "httpStatuses": dict(status_counts),
            "latencyMs": {
                "min": round(min(latencies), 2) if latencies else None,
                "mean": round(mean(latencies), 2) if latencies else None,
                "p50": percentile(latencies, 50),
                "p95": percentile(latencies, 95),
                "p99": percentile(latencies, 99),
                "max": round(max(latencies), 2) if latencies else None,
            },
        }
    return summary


def render_html(report: dict[str, Any]) -> str:
    metadata = report["metadata"]
    summary = report["summary"]
    phase_rows = []
    for phase, item in report["phases"].items():
        latency = item["latencyMs"]
        phase_rows.append(
            "<tr>"
            f"<td>{html.escape(phase)}</td><td>{item['requests']}</td><td>{item['ok']}</td>"
            f"<td>{item['failed']}</td><td>{latency['p50'] or '-'} / {latency['p95'] or '-'} / {latency['p99'] or '-'} ms</td>"
            f"<td>{html.escape(json.dumps(item['httpStatuses'], ensure_ascii=False))}</td></tr>"
        )
    user_rows = []
    for user in report["users"]:
        submission = user.get("submission") or {}
        user_rows.append(
            "<tr>"
            f"<td>{user['index']}</td><td>{html.escape(user['account'])}</td><td>{html.escape(user['proxyId'])}</td>"
            f"<td>{'是' if user.get('ready') else '否'}</td>"
            f"<td>{'是' if submission.get('ok') else '否'}</td>"
            f"<td>{html.escape(str(submission.get('httpStatus') or '-'))}</td>"
            f"<td>{html.escape(str(user.get('finalStatus') or '-'))}</td>"
            f"<td>{html.escape(str(user.get('error') or submission.get('message') or ''))}</td></tr>"
        )
    return f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>QOJ 比赛压测报告</title>
<style>body{{font:14px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:32px;color:#1f2937}}
table{{border-collapse:collapse;width:100%;margin:12px 0 28px}}th,td{{border:1px solid #d1d5db;padding:7px;text-align:left}}th{{background:#f3f4f6}}
.grid{{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}}.card{{border:1px solid #d1d5db;border-radius:8px;padding:12px}}
code{{background:#f3f4f6;padding:2px 4px;border-radius:4px}}</style></head><body>
<h1>QOJ 比赛压测报告</h1>
<p>开始：{html.escape(metadata['startedAt'])}　结束：{html.escape(metadata['finishedAt'])}</p>
<p>目标：<code>{html.escape(metadata['target'])}</code>　比赛：{metadata['contestId']}　题目：{metadata['problemId']}　语言：{html.escape(metadata['language'])}</p>
<div class="grid"><div class="card">请求数<br><strong>{summary['requests']}</strong></div>
<div class="card">成功请求<br><strong>{summary['ok']}</strong></div><div class="card">失败请求<br><strong>{summary['failed']}</strong></div>
<div class="card">提交成功<br><strong>{summary['submissionOk']}</strong></div></div>
<h2>阶段汇总</h2><table><thead><tr><th>阶段</th><th>请求</th><th>成功</th><th>失败</th><th>P50 / P95 / P99</th><th>HTTP 状态</th></tr></thead><tbody>{''.join(phase_rows)}</tbody></table>
<h2>用户结果</h2><table><thead><tr><th>#</th><th>账号</th><th>代理</th><th>准备完成</th><th>提交成功</th><th>HTTP</th><th>最终状态</th><th>备注</th></tr></thead><tbody>{''.join(user_rows)}</tbody></table>
</body></html>"""


def write_report(report: dict[str, Any], report_dir: str) -> tuple[Path, Path]:
    output_dir = Path(report_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    json_path = output_dir / f"contest-loadtest-{stamp}.json"
    html_path = output_dir / f"contest-loadtest-{stamp}.html"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    html_path.write_text(render_html(report), encoding="utf-8")
    return json_path, html_path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="QOJ 100 用户比赛并发提交压测工具")
    parser.add_argument("--env-file", default=None, help="可选的本地 KEY=VALUE 配置文件")
    parser.add_argument("--base-url", default=os.getenv("QOJ_BASE_URL"), help="网站根地址，例如 https://oj.example.com")
    parser.add_argument("--contest-id", type=int, default=int(os.getenv("QOJ_CONTEST_ID", "0") or 0))
    parser.add_argument("--problem-id", type=int, default=int(os.getenv("QOJ_PROBLEM_ID", "0") or 0), help="比赛题目 ID（通常是 contest_problems.id）")
    parser.add_argument("--accounts", default=os.getenv("QOJ_ACCOUNTS_FILE"), help="username,password CSV")
    parser.add_argument("--code-file", default=os.getenv("QOJ_CODE_FILE"), help="提交源码文件；不传则使用内置最小源码")
    parser.add_argument("--language", choices=sorted(DEFAULT_CODE), default=os.getenv("QOJ_LANGUAGE", "cpp"))
    parser.add_argument("--users", type=int, default=int(os.getenv("QOJ_USERS", "100") or 100))
    parser.add_argument("--proxy-api-url", default=os.getenv("QOJ_PROXY_API_URL"), help="代理池接口；不要把密钥提交到仓库")
    parser.add_argument("--proxy-batch-size", type=int, default=10)
    parser.add_argument("--proxy-fetch-delay", type=float, default=0.5)
    parser.add_argument("--allow-direct", action="store_true", help="没有代理时允许直连；线上测试不建议使用")
    parser.add_argument("--register", action=argparse.BooleanOptionalAction, default=False, help="压测前为每个账号报名比赛")
    parser.add_argument("--registration-password", default=os.getenv("QOJ_REGISTRATION_PASSWORD"))
    parser.add_argument("--preflight", action=argparse.BooleanOptionalAction, default=True, help="执行一次比赛详情预检")
    parser.add_argument("--allow-partial", action="store_true", help="部分账号准备成功时也发送这些账号的提交")
    parser.add_argument("--ramp-up-seconds", type=float, default=0.0, help="提交释放后的线性爬坡时间，默认 0 表示同时提交")
    parser.add_argument("--submit-jitter-ms", type=int, default=0, help="提交随机抖动，默认 0")
    parser.add_argument("--wait-for-results", action=argparse.BooleanOptionalAction, default=False)
    parser.add_argument("--result-timeout-seconds", type=float, default=180.0)
    parser.add_argument("--poll-interval-seconds", type=float, default=2.0)
    parser.add_argument("--poll-concurrency", type=int, default=20)
    parser.add_argument("--timeout-seconds", type=float, default=45.0)
    parser.add_argument("--report-dir", default=os.getenv("QOJ_REPORT_DIR", "tools/contest-loadtest/reports"))
    parser.add_argument("--execute", action="store_true", help="真正发起请求；不传则只做本地校验")
    parser.add_argument("--confirm-online", action="store_true", help="确认你已获目标站点所有者授权进行线上压测")
    return parser


async def run_test(args: argparse.Namespace, accounts: list[Account], source: str) -> dict[str, Any]:
    started_at = utc_now()
    proxy_urls: list[str] = []
    if args.proxy_api_url:
        proxy_urls = await fetch_proxy_pool(args.proxy_api_url, args.users, args.proxy_batch_size, args.proxy_fetch_delay)
    assignments = assignment_pool(proxy_urls, args.users, args.allow_direct)
    async with QojLoadClient(args.base_url, args.users, args.timeout_seconds, args.poll_concurrency) as client:
        if args.preflight:
            await client.request(
                "preflight", None, None, assignments[0], "GET", f"/api/v1/contests/{args.contest_id}"
            )

        prepared = await asyncio.gather(*(
            prepare_user(client, index, account, assignments[index], args)
            for index, account in enumerate(accounts)
        ))
        ready_count = sum(item.get("ready", False) for item in prepared)
        release = asyncio.Event()
        if ready_count == args.users or args.allow_partial:
            submit_tasks = [
                asyncio.create_task(submit_user(client, item, assignments[index], args, source, release))
                for index, item in enumerate(prepared) if item.get("ready")
            ]
            release.set()
            if submit_tasks:
                await asyncio.gather(*submit_tasks)
        else:
            for item in prepared:
                if not item.get("ready"):
                    item["error"] = item.get("error") or "未达到全员就绪，按安全策略未发送提交"

        finished_at = utc_now()
        records = [asdict(record) for record in client.records]
        phases = phase_summary(client.records)
        submission_records = [record for record in client.records if record.phase == "submit"]
        report = {
            "metadata": {
                "startedAt": started_at,
                "finishedAt": finished_at,
                "target": args.base_url,
                "contestId": args.contest_id,
                "problemId": args.problem_id,
                "language": args.language,
                "usersRequested": args.users,
                "usersReady": ready_count,
                "proxyCount": len(proxy_urls),
                "proxyReuse": bool(proxy_urls and len(proxy_urls) < args.users),
                "proxySourceConfigured": bool(args.proxy_api_url),
                "register": args.register,
                "waitForResults": args.wait_for_results,
            },
            "summary": {
                "requests": len(client.records),
                "ok": sum(record.ok for record in client.records),
                "failed": sum(not record.ok for record in client.records),
                "submissionRequests": len(submission_records),
                "submissionOk": sum(record.ok for record in submission_records),
                "submission429": sum(record.http_status == 429 for record in submission_records),
            },
            "phases": phases,
            "users": [{key: value for key, value in item.items() if not key.startswith("_")} for item in prepared],
            "requests": records,
        }
        return report


def validate_args(args: argparse.Namespace) -> tuple[list[Account], str]:
    if not args.base_url:
        raise SystemExit("请配置 --base-url 或 QOJ_BASE_URL")
    args.base_url = normalize_base_url(args.base_url)
    if args.contest_id <= 0 or args.problem_id <= 0:
        raise SystemExit("--contest-id 和 --problem-id 必须是正整数")
    if args.users < 1 or args.users > 100:
        raise SystemExit("默认只允许 1-100 个用户，避免误把脚本扩大成无界压测")
    if not args.accounts:
        raise SystemExit("请配置 --accounts 或 QOJ_ACCOUNTS_FILE")
    if args.proxy_batch_size < 1 or args.proxy_batch_size > 50:
        raise SystemExit("--proxy-batch-size 应在 1-50 之间")
    if args.submit_jitter_ms < 0 or args.ramp_up_seconds < 0:
        raise SystemExit("提交抖动和爬坡时间不能为负数")
    if args.execute and not args.confirm_online:
        raise SystemExit("线上发压必须同时传 --execute --confirm-online")
    if args.execute and not args.proxy_api_url and not args.allow_direct:
        raise SystemExit("线上发压默认必须配置代理池；如确需直连，请显式传 --allow-direct")
    accounts = read_accounts(args.accounts, args.users)
    source = load_code(args.code_file, args.language)
    return accounts, source


def print_dry_run(args: argparse.Namespace, accounts: list[Account], source: str) -> None:
    print("Dry-run：未发起网络请求。")
    print(f"目标：{args.base_url}")
    print(f"比赛/题目：{args.contest_id}/{args.problem_id}")
    print(f"用户数：{args.users}，语言：{args.language}，源码：{len(source.encode('utf-8'))} bytes")
    print(f"代理池：{'已配置' if args.proxy_api_url else '未配置'}，报名：{'是' if args.register else '否'}")
    print(f"账号样例：{mask_username(accounts[0].username)}（密码不会打印）")


async def async_main(args: argparse.Namespace) -> int:
    accounts, source = validate_args(args)
    if not args.execute:
        print_dry_run(args, accounts, source)
        return 0
    report = await run_test(args, accounts, source)
    json_path, html_path = write_report(report, args.report_dir)
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    print(f"JSON 报告：{json_path}")
    print(f"HTML 报告：{html_path}")
    return 0 if report["summary"]["submissionOk"] == args.users else 2


def main() -> int:
    pre_parser = argparse.ArgumentParser(add_help=False)
    pre_parser.add_argument("--env-file")
    pre_args, _ = pre_parser.parse_known_args()
    load_env_file(pre_args.env_file)
    parser = build_parser()
    args = parser.parse_args()
    try:
        return asyncio.run(async_main(args))
    except KeyboardInterrupt:
        print("\n已中断，未自动重试提交。", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
