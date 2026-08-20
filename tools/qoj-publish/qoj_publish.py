#!/usr/bin/env python3
"""qoj-publish - validate, verify, and upload OI problem bundles to QOJ.

The command line tool uses only the Python standard library.  It deliberately
keeps upload at DRAFT: a teacher must inspect the rendered statement before
publishing it.

Commands:
  preflight   Validate problem.json and data.zip locally.
  login       Login with the QOJ captcha flow and cache the tokens locally.
  push        Create a draft, upload the statement and test cases, then commit.
  verify      Re-run a solution locally, including a testlib checker when set.
"""

import argparse
import base64
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile


# QOJ service contract. Keep these values in sync with the backend validators.
API_SUCCESS_CODE = 200
TITLE_MAX = 200
TIME_LIMIT_MIN, TIME_LIMIT_MAX = 100, 60000
MEMORY_LIMIT_MIN, MEMORY_LIMIT_MAX = 16, 1024
DIFFICULTY_MIN, DIFFICULTY_MAX = 1, 5
DEFAULT_FOLDER_ID = 7
MAX_CHECKER_SOURCE_CHARS = 200000
MAX_ZIP_TEST_CASES = 200
MAX_ZIP_ENTRY_BYTES = 2 * 1024 * 1024
MAX_ZIP_TOTAL_BYTES = 50 * 1024 * 1024
CASE_NAME_RE = re.compile(r"^(\d+)\.(in|out)$")
CACHE_DIR = os.path.expanduser("~/.qoj-publish")

LANG_SPEC = {
    "cpp": {
        "src": "main.cpp",
        "compile": ["/usr/bin/g++", "-std=c++17", "-O2", "-pipe", "main.cpp", "-o", "main"],
        "run": ["./main"],
    },
    "c": {
        "src": "main.c",
        "compile": ["/usr/bin/gcc", "-std=c11", "-O2", "-pipe", "main.c", "-o", "main"],
        "run": ["./main"],
    },
    "python": {
        "src": "main.py",
        "compile": [sys.executable, "-m", "py_compile", "main.py"],
        "run": [sys.executable, "main.py"],
    },
    "java": {
        "src": "Main.java",
        "compile": ["javac", "Main.java"],
        "run": ["java", "Main"],
    },
}
LANG_ALIAS = {
    "c": "c",
    "cpp": "cpp", "c++": "cpp", "cxx": "cpp", "g++": "cpp",
    "python": "python", "python3": "python", "py": "python",
    "java": "java",
}
EXT_LANG = {".cpp": "cpp", ".cc": "cpp", ".cxx": "cpp", ".c": "c",
            ".py": "python", ".java": "java"}


class QojError(Exception):
    pass


def eprint(*args):
    print(*args, file=sys.stderr)


def tokenize(value):
    if value is None:
        return []
    stripped = value.strip()
    return re.split(r"\s+", stripped) if stripped else []


def same_output(actual, expected):
    a, e = tokenize(actual), tokenize(expected)
    return len(a) == len(e) and all(x == y for x, y in zip(a, e))


def host_key(base_url):
    host = urllib.parse.urlparse(base_url).netloc or base_url
    return re.sub(r"[^A-Za-z0-9._-]", "_", host)


def cache_path(base_url):
    return os.path.join(CACHE_DIR, host_key(base_url) + ".json")


class QojClient:
    def __init__(self, base_url, token_store=None):
        self.base_url = base_url.rstrip("/")
        self.token_store = token_store

    def _request(self, method, path, *, data=None, headers=None, auth=False):
        hdrs = dict(headers or {})
        if auth and self.token_store:
            hdrs["Authorization"] = "Bearer " + self.token_store["accessToken"]
        req = urllib.request.Request(self.base_url + path, data=data, method=method, headers=hdrs)
        try:
            with urllib.request.urlopen(req, timeout=210) as resp:
                return resp.status, resp.read()
        except urllib.error.HTTPError as exc:
            return exc.code, exc.read()

    def _json_call(self, method, path, body=None, *, auth=False, _retry=True):
        data = None
        headers = {"Accept": "application/json"}
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        status, raw = self._request(method, path, data=data, headers=headers, auth=auth)
        if status == 401 and auth and _retry and self.token_store:
            self.refresh_tokens()
            return self._json_call(method, path, body, auth=auth, _retry=False)
        return self._parse(status, raw, path)

    def _parse(self, status, raw, path):
        try:
            payload = json.loads(raw.decode("utf-8")) if raw else {}
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise QojError(f"{path} 返回非 JSON（HTTP {status}）：{raw[:200]!r}")
        if payload.get("code") != API_SUCCESS_CODE:
            raise QojError(
                f"{path} 失败：code={payload.get('code')} message={payload.get('message', '')} "
                f"(HTTP {status})")
        return payload.get("data")

    def get_json(self, path, *, auth=False):
        return self._json_call("GET", path, auth=auth)

    def post_json(self, path, body=None, *, auth=False):
        return self._json_call("POST", path, body, auth=auth)

    def put_json(self, path, body, *, auth=False):
        return self._json_call("PUT", path, body, auth=auth)

    def post_multipart(self, path, field_name, filename, file_bytes, extra_fields=None,
                       *, auth=True, _retry=True):
        boundary = "----qojpublish" + base64.urlsafe_b64encode(os.urandom(12)).decode()
        parts = []
        for key, value in (extra_fields or {}).items():
            parts.extend([
                f"--{boundary}\r\n".encode(),
                f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode(),
                f"{value}\r\n".encode(),
            ])
        parts.extend([
            f"--{boundary}\r\n".encode(),
            f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"\r\n'.encode(),
            b"Content-Type: application/zip\r\n\r\n",
            file_bytes,
            f"\r\n--{boundary}--\r\n".encode(),
        ])
        headers = {
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Accept": "application/json",
        }
        if auth and self.token_store:
            headers["Authorization"] = "Bearer " + self.token_store["accessToken"]
        status, raw = self._request("POST", path, data=b"".join(parts), headers=headers)
        if status == 401 and auth and _retry and self.token_store:
            self.refresh_tokens()
            return self.post_multipart(path, field_name, filename, file_bytes,
                                       extra_fields, auth=auth, _retry=False)
        return self._parse(status, raw, path)

    def refresh_tokens(self):
        if not self.token_store or not self.token_store.get("refreshToken"):
            raise QojError("access token 过期且没有 refresh token，请重新 login。")
        data = self._json_call("POST", "/api/v1/auth/refresh",
                               {"refreshToken": self.token_store["refreshToken"]},
                               auth=False, _retry=False)
        self.token_store["accessToken"] = data["accessToken"]
        self.token_store["refreshToken"] = data["refreshToken"]
        self.token_store["savedAt"] = int(time.time())
        save_token_store(self.base_url, self.token_store)


def load_token_store(base_url):
    path = cache_path(base_url)
    if not os.path.exists(path):
        raise QojError(f"未找到凭证 {path}，请先运行 login。")
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def save_token_store(base_url, store):
    os.makedirs(CACHE_DIR, exist_ok=True)
    os.chmod(CACHE_DIR, 0o700)
    path = cache_path(base_url)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(store, handle, ensure_ascii=False, indent=2)
    os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)


def fetch_captcha(client):
    data = client.get_json("/api/v1/captcha/image")
    return data["captchaId"], data["image"]


def do_login(client, role, username, password, captcha_id, captcha):
    endpoint = "/api/teacher/v1/auth/login" if role == "teacher" else "/api/admin/v1/auth/login"
    data = client.post_json(endpoint, {
        "username": username, "password": password,
        "captchaId": captcha_id, "captcha": captcha,
    })
    store = {
        "baseUrl": client.base_url,
        "role": role,
        "accessToken": data["accessToken"],
        "refreshToken": data["refreshToken"],
        "savedAt": int(time.time()),
    }
    save_token_store(client.base_url, store)
    return store


def load_problem(problem_path):
    with open(problem_path, encoding="utf-8") as handle:
        problem = json.load(handle)
    if not isinstance(problem, dict):
        raise ValueError("顶层必须是 JSON 对象")
    return problem


MD_LEAK_RE = re.compile(r"(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```)" )


def _is_construction(problem):
    """Return whether the bundle intentionally permits absent reference outputs."""
    return problem.get("construction") is True or problem.get("needsChecker") is True


def _check_basic_fields(problem, errors, warnings):
    title = problem.get("title")
    if not title or not str(title).strip():
        errors.append("title 不能为空")
    elif not isinstance(title, str):
        errors.append("title 必须是字符串")
    elif len(title) > TITLE_MAX:
        errors.append(f"title 超长：{len(title)} > {TITLE_MAX}")

    time_limit = problem.get("timeLimit")
    if not isinstance(time_limit, int) or not (TIME_LIMIT_MIN <= time_limit <= TIME_LIMIT_MAX):
        errors.append(f"timeLimit 需为整数且在 [{TIME_LIMIT_MIN},{TIME_LIMIT_MAX}] ms，当前 {time_limit!r}")
    memory_limit = problem.get("memoryLimit")
    if not isinstance(memory_limit, int) or not (MEMORY_LIMIT_MIN <= memory_limit <= MEMORY_LIMIT_MAX):
        errors.append(f"memoryLimit 需为整数且在 [{MEMORY_LIMIT_MIN},{MEMORY_LIMIT_MAX}] MB，当前 {memory_limit!r}")

    difficulty = problem.get("difficulty")
    if difficulty is not None and (not isinstance(difficulty, int) or
                                   not (DIFFICULTY_MIN <= difficulty <= DIFFICULTY_MAX)):
        errors.append(f"difficulty 需在 [{DIFFICULTY_MIN},{DIFFICULTY_MAX}]，当前 {difficulty!r}")

    statement = problem.get("statement")
    if not isinstance(statement, str) or not statement.strip():
        errors.append("statement 不能为空")
    for field in ("statement", "inputFormat", "outputFormat"):
        value = problem.get(field)
        if value is not None and not isinstance(value, str):
            errors.append(f"{field} 必须是字符串")
            continue
        if isinstance(value, str) and MD_LEAK_RE.search(value):
            warnings.append(
                f"{field} 疑似含 markdown 结构语法（#、- 、``` 等）；"
                "QOJ 这三个字段按 HTML+LaTeX 渲染，markdown 结构不会生效。")

    checker_source = problem.get("checkerSource", "")
    if checker_source is None:
        checker_source = ""
    if not isinstance(checker_source, str):
        errors.append("checkerSource 必须是字符串")
    elif len(checker_source) > MAX_CHECKER_SOURCE_CHARS:
        errors.append(f"checkerSource 超长：{len(checker_source)} > {MAX_CHECKER_SOURCE_CHARS}")

    construction_present = "construction" in problem
    construction = problem.get("construction", False)
    needs_checker = problem.get("needsChecker", None)
    if construction_present and not isinstance(construction, bool):
        errors.append("construction 必须是布尔值")
    if needs_checker is not None and not isinstance(needs_checker, bool):
        errors.append("needsChecker 必须是布尔值")
    if (construction_present and isinstance(construction, bool) and
            isinstance(needs_checker, bool) and construction != needs_checker):
        errors.append("construction 与兼容字段 needsChecker 的值必须一致")
    effective_construction = _is_construction(problem)
    if effective_construction and isinstance(checker_source, str) and not checker_source.strip():
        errors.append("构造题必须提供非空 checkerSource（testlib checker）")


def _check_samples(problem, errors, warnings):
    samples = problem.get("samples")
    if samples is None:
        warnings.append("没有 samples；题面通常至少要有一个样例。")
        return
    if not isinstance(samples, list):
        errors.append("samples 必须是数组")
        return
    for index, sample in enumerate(samples, 1):
        if not isinstance(sample, dict):
            errors.append(f"样例 #{index} 不是对象")
            continue
        if not sample.get("input") or not str(sample["input"]).strip():
            errors.append(f"样例 #{index} input 不能为空")
        if not sample.get("output") or not str(sample["output"]).strip():
            errors.append(f"样例 #{index} output 不能为空")


def inspect_zip(zip_path, errors, warnings, *, allow_missing_output=False):
    """Check flat, consecutive case files and QOJ size limits.

    Pure construction problems may omit any ``.out`` file.  QOJ still invokes
    testlib with an answer-file argument; the local verifier creates an empty
    one for missing files so the checker sees the same contract as production.
    """
    if not zipfile.is_zipfile(zip_path):
        errors.append(f"{zip_path} 不是合法的 zip")
        return []
    inputs, outputs, total = {}, {}, 0
    with zipfile.ZipFile(zip_path) as archive:
        for info in archive.infolist():
            name = info.filename
            if name.endswith("/"):
                continue
            if "/" in name or "\\" in name:
                errors.append(f"data.zip 含子目录条目：{name}（必须扁平在根目录）")
                continue
            match = CASE_NAME_RE.match(name)
            if not match:
                errors.append(f"data.zip 含非法文件名：{name}（只允许 \\d+.in / \\d+.out）")
                continue
            number, kind = int(match.group(1)), match.group(2)
            size = info.file_size
            total += size
            if size > MAX_ZIP_ENTRY_BYTES:
                errors.append(f"{name} 单文件 {size} 字节 > 2MB 判题上限")
            (inputs if kind == "in" else outputs)[number] = size

    input_numbers, output_numbers = set(inputs), set(outputs)
    only_input = sorted(input_numbers - output_numbers)
    only_output = sorted(output_numbers - input_numbers)
    if only_input and not allow_missing_output:
        errors.append(f"缺少对应 .out 的用例：{only_input}")
    if only_output:
        errors.append(f"缺少对应 .in 的用例：{only_output}")
    numbers = sorted(input_numbers)
    if numbers:
        expected = list(range(1, len(numbers) + 1))
        if numbers != expected:
            errors.append(f"用例编号必须从 1 连续：实际 {numbers}，应为 {expected}")
        if len(numbers) > MAX_ZIP_TEST_CASES:
            errors.append(f"用例数 {len(numbers)} > 上限 {MAX_ZIP_TEST_CASES}")
    else:
        errors.append("data.zip 里没有任何用例")
    if total > MAX_ZIP_TOTAL_BYTES:
        errors.append(f"data.zip 总解压大小 {total} > 50MB 上限")
    return numbers


def _mark_construction(problem):
    problem["construction"] = True
    # Keep the old metadata spelling coherent when it is present.
    if "needsChecker" in problem:
        problem["needsChecker"] = True


def _apply_construction_flag(problem, args):
    if getattr(args, "construction", False):
        _mark_construction(problem)


def _validate_problem_bundle(problem_path, data_path):
    errors, warnings = [], []
    try:
        problem = load_problem(problem_path)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        return None, [f"无法读取 problem.json：{exc}"], [], []
    _check_basic_fields(problem, errors, warnings)
    _check_samples(problem, errors, warnings)
    if os.path.exists(data_path):
        numbers = inspect_zip(
            data_path,
            errors,
            warnings,
            allow_missing_output=_is_construction(problem),
        )
    else:
        numbers = []
        errors.append(f"找不到数据包 {data_path}")
    return problem, errors, warnings, numbers


def cmd_preflight(args):
    problem, errors, warnings, numbers = _validate_problem_bundle(args.problem, args.data)
    for warning in warnings:
        print(f"[warn] {warning}")
    if numbers and not errors:
        print(f"data.zip：{len(numbers)} 个用例，编号 1..{len(numbers)}")
    if errors:
        for error in errors:
            eprint(f"[error] {error}")
        eprint(f"\npreflight 失败：{len(errors)} 个错误。")
        return 1
    print("preflight 通过。可以 login 后 push。")
    return 0


def cmd_login(args):
    client = QojClient(args.base_url)
    captcha_id, data_url = fetch_captcha(client)
    encoded = data_url.split(",", 1)[1] if "," in data_url else data_url
    image_path = os.path.join(tempfile.gettempdir(), "qoj-captcha.png")
    with open(image_path, "wb") as handle:
        handle.write(base64.b64decode(encoded))
    print(f"验证码图片已保存到 {image_path}，请打开查看。")
    try:
        subprocess.run(["open", image_path], check=False,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except OSError:
        pass

    username = args.username or input("用户名: ").strip()
    import getpass
    password = getpass.getpass("密码: ")
    captcha = input("验证码(4位): ").strip()
    do_login(client, args.role, username, password, captcha_id, captcha)
    print(f"登录成功，凭证已写入 {cache_path(args.base_url)} (0600)。")
    return 0


def _build_basic_body(problem):
    """Build PUT /basic; construction is local metadata, checkerSource is API data."""
    return {
        "title": problem["title"],
        "timeLimit": problem["timeLimit"],
        "memoryLimit": problem["memoryLimit"],
        "statement": problem["statement"],
        "inputFormat": problem.get("inputFormat"),
        "outputFormat": problem.get("outputFormat"),
        "checkerSource": problem.get("checkerSource") or None,
        "tags": problem.get("tags", []),
        "difficulty": problem.get("difficulty"),
        "folderId": problem.get("folderId", DEFAULT_FOLDER_ID),
        "majorId": problem.get("majorId"),
        "accessScope": problem.get("accessScope"),
        "samples": [
            {"input": sample["input"], "output": sample["output"],
             "explanation": sample.get("explanation")}
            for sample in problem.get("samples", [])
        ],
        "isPublic": False,
        "studentPublishStatus": "DRAFT",
    }


def cmd_push(args):
    problem, errors, warnings, _ = _validate_problem_bundle(args.problem, args.data)
    if problem is not None:
        _apply_construction_flag(problem, args)
        # The flag is applied after loading so it can turn an otherwise ordinary
        # bundle into a construction bundle for this invocation only.
        errors, warnings = [], []
        _check_basic_fields(problem, errors, warnings)
        _check_samples(problem, errors, warnings)
        if os.path.exists(args.data):
            inspect_zip(
                args.data,
                errors,
                warnings,
                allow_missing_output=_is_construction(problem),
            )
        else:
            errors.append(f"找不到数据包 {args.data}")
    for warning in warnings:
        print(f"[warn] {warning}")
    if errors:
        for error in errors:
            eprint(f"[error] {error}")
        eprint("push 中止：请先修正 preflight 错误。")
        return 1

    client = QojClient(args.base_url, token_store=load_token_store(args.base_url))
    draft = client.post_json("/api/admin/v1/problem-drafts", auth=True)
    draft_id = draft["draftId"]
    print(f"已建草稿 {draft_id}")
    client.put_json(f"/api/admin/v1/problem-drafts/{draft_id}/basic",
                    _build_basic_body(problem), auth=True)
    print("已写入题面（DRAFT，isPublic=false）")
    with open(args.data, "rb") as handle:
        zip_bytes = handle.read()
    client.post_multipart(f"/api/admin/v1/problem-drafts/{draft_id}/test-cases/zip",
                          "file", os.path.basename(args.data), zip_bytes,
                          {"overwrite": "true"})
    print("已上传数据包")
    committed = client.post_json(f"/api/admin/v1/problem-drafts/{draft_id}/commit", auth=True)
    problem_id = committed.get("id") or committed.get("problemId")
    print(f"\ncommit 成功，题目 id={problem_id}，状态仍为 DRAFT。")
    print("请到后台人工检查题面渲染并手动发布；CLI 不会自动 PUBLISHED。")
    return 0


def _resolve_lang(args):
    if args.lang:
        key = LANG_ALIAS.get(args.lang.strip().lower())
        if not key:
            raise QojError(f"未知语言：{args.lang}")
        return key
    key = EXT_LANG.get(os.path.splitext(args.solution)[1].lower())
    if not key:
        raise QojError(f"无法从扩展名推断语言，请用 --lang 指定。")
    return key


def _checker_config_from_problem(problem_path):
    if not problem_path:
        return "", False
    try:
        problem = load_problem(problem_path)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        raise QojError(f"无法读取 verify 的 problem.json：{exc}")
    errors, warnings = [], []
    _check_basic_fields(problem, errors, warnings)
    if errors:
        raise QojError("problem.json 校验失败：" + "；".join(errors))
    return problem.get("checkerSource") or "", _is_construction(problem)


def _default_testlib_path():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..",
                                        "backend", "src", "main", "resources", "judge", "testlib.h"))


def _compile_checker(source, work, testlib_path):
    if not os.path.isfile(testlib_path):
        raise QojError(f"找不到 testlib.h：{testlib_path}（可用 --testlib 指定路径）")
    checker_src = os.path.join(work, "checker.cpp")
    with open(checker_src, "w", encoding="utf-8") as handle:
        handle.write(source)
    shutil.copyfile(testlib_path, os.path.join(work, "testlib.h"))
    compiler = "/usr/bin/g++" if os.path.exists("/usr/bin/g++") else shutil.which("g++")
    if not compiler:
        raise QojError("找不到 g++，无法编译 testlib checker")
    command = [compiler, "-std=c++17", "-O2", "-pipe", "-I", work,
               "checker.cpp", "-o", "checker"]
    try:
        result = subprocess.run(command, cwd=work, capture_output=True,
                                text=True, timeout=60)
    except subprocess.TimeoutExpired:
        raise QojError("checker 编译超时")
    except OSError as exc:
        raise QojError(f"checker 编译器启动失败：{exc}")
    if result.returncode != 0:
        raise QojError("checker 编译失败：\n" + result.stderr)


def _safe_extract_cases(zip_path, cases_dir, numbers):
    os.makedirs(cases_dir, exist_ok=True)
    wanted = {f"{number}.{kind}" for number in numbers for kind in ("in", "out")}
    with zipfile.ZipFile(zip_path) as archive:
        for info in archive.infolist():
            if info.filename not in wanted:
                continue
            target = os.path.join(cases_dir, info.filename)
            with archive.open(info) as source, open(target, "wb") as destination:
                shutil.copyfileobj(source, destination)


def _load_or_create_answer(cases_dir, number):
    """Return a case's reference output, materializing an empty answer if absent."""
    answer_path = os.path.join(cases_dir, f"{number}.out")
    if not os.path.exists(answer_path):
        # QOJ always provides the third testlib argument, even for a pure
        # construction case whose package deliberately has no reference output.
        with open(answer_path, "wb"):
            pass
        return answer_path, b""
    with open(answer_path, "rb") as handle:
        return answer_path, handle.read()


def cmd_verify(args):
    try:
        lang = _resolve_lang(args)
        checker_source, construction = _checker_config_from_problem(args.problem)
    except QojError as exc:
        eprint(str(exc))
        return 2
    spec = LANG_SPEC[lang]
    if not os.path.exists(args.solution):
        eprint(f"找不到 solution 源文件 {args.solution}")
        return 2
    if not zipfile.is_zipfile(args.data):
        eprint(f"{args.data} 不是合法 zip")
        return 2

    with tempfile.TemporaryDirectory(prefix="qoj-verify-") as work:
        source_destination = os.path.join(work, spec["src"])
        with open(args.solution, "rb") as source, open(source_destination, "wb") as destination:
            shutil.copyfileobj(source, destination)
        try:
            compile_result = subprocess.run(spec["compile"], cwd=work, capture_output=True,
                                            text=True, timeout=60)
        except FileNotFoundError:
            eprint(f"编译器不存在：{spec['compile'][0]}（本地缺 {lang} 工具链）")
            return 2
        except subprocess.TimeoutExpired:
            eprint("编译超时")
            return 1
        if compile_result.returncode != 0:
            eprint("编译失败：\n" + compile_result.stderr)
            return 1

        errors, warnings = [], []
        numbers = inspect_zip(
            args.data,
            errors,
            warnings,
            allow_missing_output=construction,
        )
        if errors:
            for error in errors:
                eprint(f"[error] {error}")
            return 1
        cases_dir = os.path.join(work, "cases")
        _safe_extract_cases(args.data, cases_dir, numbers)
        checker_command = None
        if checker_source:
            try:
                _compile_checker(checker_source, work, args.testlib or _default_testlib_path())
            except QojError as exc:
                eprint(str(exc))
                return 1
            checker_command = ["./checker"]
            print("已编译 testlib checker（参数顺序：input actual answer）")

        time_limit_s = args.time_limit / 1000.0 if args.time_limit else 10.0
        passed, failed = 0, []
        for number in numbers:
            input_path = os.path.join(cases_dir, f"{number}.in")
            with open(input_path, "rb") as handle:
                stdin_data = handle.read()
            answer_path, expected_bytes = _load_or_create_answer(cases_dir, number)
            try:
                run = subprocess.run(spec["run"], cwd=work, input=stdin_data,
                                     capture_output=True, timeout=time_limit_s)
            except subprocess.TimeoutExpired:
                failed.append((number, "TLE"))
                print(f"用例 {number}: TLE (>{time_limit_s:.1f}s)")
                continue
            if run.returncode != 0:
                failed.append((number, f"RE(exit={run.returncode})"))
                print(f"用例 {number}: RE exit={run.returncode}")
                continue
            actual_bytes = run.stdout
            if checker_command:
                actual_path = os.path.join(work, f"actual-{number}.out")
                with open(actual_path, "wb") as handle:
                    handle.write(actual_bytes)
                try:
                    checker = subprocess.run(
                        checker_command + [input_path, actual_path, answer_path],
                        cwd=work, capture_output=True, text=True, timeout=10.0)
                except subprocess.TimeoutExpired:
                    failed.append((number, "CHECKER_TIMEOUT"))
                    print(f"用例 {number}: checker timeout (>10.0s)")
                    continue
                if checker.returncode == 0:
                    passed += 1
                    print(f"用例 {number}: AC (checker)")
                elif checker.returncode in (1, 2):
                    failed.append((number, "WA"))
                    print(f"用例 {number}: WA (checker)")
                else:
                    failed.append((number, f"CHECKER_ERROR(exit={checker.returncode})"))
                    detail = checker.stderr.strip() or checker.stdout.strip()
                    print(f"用例 {number}: checker error exit={checker.returncode}"
                          + (f"：{detail}" if detail else ""))
            else:
                actual = actual_bytes.decode("utf-8", errors="replace")
                expected = expected_bytes.decode("utf-8", errors="replace")
                if same_output(actual, expected):
                    passed += 1
                    print(f"用例 {number}: AC")
                else:
                    failed.append((number, "WA"))
                    print(f"用例 {number}: WA")

        print(f"\n结果：{passed}/{len(numbers)} AC")
        if failed:
            print("未通过：" + ", ".join(f"{number}({reason})" for number, reason in failed))
            return 1
        if checker_command:
            print("全部通过（testlib checker 参数顺序与 QOJ Docker judge 一致）。")
        else:
            print("全部通过（本地 token 比对规则与 QOJ go-judge 一致）。")
        return 0


def build_parser():
    parser = argparse.ArgumentParser(
        prog="qoj-publish", description="把出题/造数据产物直传 QOJ（止步 DRAFT，人工发布）")
    sub = parser.add_subparsers(dest="command", required=True)

    preflight = sub.add_parser("preflight", help="本地校验 problem.json + data.zip，不联网")
    preflight.add_argument("--problem", default="problem.json")
    preflight.add_argument("--data", default="data.zip")
    preflight.set_defaults(func=cmd_preflight)

    login = sub.add_parser("login", help="交互式验证码登录，缓存 token")
    login.add_argument("--base-url", required=True)
    login.add_argument("--role", choices=["teacher", "admin"], default="teacher")
    login.add_argument("--username")
    login.set_defaults(func=cmd_login)

    push = sub.add_parser("push", help="建草稿→填题面→传数据→commit（永远 DRAFT）")
    push.add_argument("--base-url", required=True)
    push.add_argument("--problem", default="problem.json")
    push.add_argument("--data", default="data.zip")
    push.add_argument("--construction", action="store_true",
                      help="将本次发布标记为构造题，并要求 problem.json 含 testlib checkerSource")
    push.set_defaults(func=cmd_push)

    verify = sub.add_parser("verify", help="本地重判；有 checkerSource 时运行 testlib checker")
    verify.add_argument("--problem", default="problem.json",
                        help="problem.json，用于读取 checkerSource；默认 problem.json")
    verify.add_argument("--solution", required=True, help="std 源文件")
    verify.add_argument("--data", default="data.zip")
    verify.add_argument("--lang", help="c/cpp/python/java；缺省按扩展名推断")
    verify.add_argument("--time-limit", type=int, help="每个用例时限(ms)，默认 10000")
    verify.add_argument("--testlib", help="testlib.h 路径，默认使用仓库 docker/judge/testlib.h")
    verify.set_defaults(func=cmd_verify)
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except QojError as exc:
        eprint(f"[qoj] {exc}")
        return 1
    except KeyboardInterrupt:
        eprint("\n已取消。")
        return 130


if __name__ == "__main__":
    sys.exit(main())
