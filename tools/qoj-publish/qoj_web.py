#!/usr/bin/env python3
"""Local browser front end for qoj_publish.

This service only listens on 127.0.0.1.  It shares validation and upload
helpers with qoj_publish.py and, like the CLI, only creates DRAFT problems.
"""

import argparse
import base64
import binascii
import http.server
import io
import json
import os
import secrets
import socketserver
import sys
import threading
import webbrowser
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qoj_publish as qp  # noqa: E402

HOST = "127.0.0.1"
DEFAULT_PORT = 8799
SESSION_TOKEN = secrets.token_urlsafe(24)
MAX_BODY_BYTES = 80 * 1024 * 1024


def _validate_bundle(problem_json, zip_bytes, construction=False):
    errors, warnings = [], []
    try:
        problem = json.loads(problem_json)
    except (json.JSONDecodeError, TypeError) as exc:
        return None, [f"problem.json 不是合法 JSON：{exc}"], [], []
    if not isinstance(problem, dict):
        return None, ["problem.json 顶层必须是对象"], [], []
    if construction:
        qp._mark_construction(problem)
    qp._check_basic_fields(problem, errors, warnings)
    qp._check_samples(problem, errors, warnings)
    if not zip_bytes:
        errors.append("没有选择 data.zip")
        return problem, errors, warnings, []
    buffer = io.BytesIO(zip_bytes)
    if not zipfile.is_zipfile(buffer):
        errors.append("data.zip 不是合法的 zip 文件")
        return problem, errors, warnings, []
    buffer.seek(0)
    cases = qp.inspect_zip(
        buffer,
        errors,
        warnings,
        allow_missing_output=qp._is_construction(problem),
    )
    return problem, errors, warnings, cases


def _decode_zip(body):
    value = body.get("dataZipB64") or ""
    if "," in value and value.lstrip().startswith("data:"):
        value = value.split(",", 1)[1]
    try:
        return base64.b64decode(value) if value else b""
    except (binascii.Error, ValueError) as exc:
        raise qp.QojError(f"data.zip 解码失败：{exc}")


def _validate_with_options(problem_json, zip_bytes, construction=False):
    return _validate_bundle(problem_json, zip_bytes, construction)


def handle_captcha(body):
    base_url = (body.get("baseUrl") or "").strip()
    if not base_url:
        raise qp.QojError("base_url 不能为空")
    captcha_id, image = qp.fetch_captcha(qp.QojClient(base_url))
    return {"captchaId": captcha_id, "image": image}


def handle_login(body):
    base_url = (body.get("baseUrl") or "").strip()
    role = body.get("role") or "teacher"
    if role not in ("teacher", "admin"):
        raise qp.QojError("role 只能是 teacher 或 admin")
    fields = [body.get("username"), body.get("password"), body.get("captchaId"), body.get("captcha")]
    if not base_url or any(not value for value in fields):
        raise qp.QojError("base_url、用户名、密码、验证码都要填，且先获取验证码")
    qp.do_login(qp.QojClient(base_url), role, body["username"].strip(), body["password"],
                body["captchaId"].strip(), body["captcha"].strip())
    return {"ok": True, "role": role, "cachePath": qp.cache_path(base_url)}


def handle_preflight(body):
    problem, errors, warnings, cases = _validate_with_options(
        body.get("problemJson") or "", _decode_zip(body), body.get("construction", False))
    return {
        "ok": not errors,
        "title": problem.get("title") if problem else None,
        "errors": errors,
        "warnings": warnings,
        "caseCount": len(cases),
    }


def handle_push(body):
    base_url = (body.get("baseUrl") or "").strip()
    if not base_url:
        raise qp.QojError("base_url 不能为空")
    zip_bytes = _decode_zip(body)
    problem, errors, warnings, _ = _validate_with_options(
        body.get("problemJson") or "", zip_bytes, body.get("construction", False))
    if errors:
        return {"ok": False, "errors": errors, "warnings": warnings}

    client = qp.QojClient(base_url, token_store=qp.load_token_store(base_url))
    steps = []
    draft = client.post_json("/api/admin/v1/problem-drafts", auth=True)
    draft_id = draft["draftId"]
    steps.append(f"已建草稿 {draft_id}")
    client.put_json(f"/api/admin/v1/problem-drafts/{draft_id}/basic",
                    qp._build_basic_body(problem), auth=True)
    steps.append("已写入题面（DRAFT，isPublic=false）")
    client.post_multipart(f"/api/admin/v1/problem-drafts/{draft_id}/test-cases/zip",
                          "file", os.path.basename(body.get("zipName") or "data.zip"),
                          zip_bytes, {"overwrite": "true"})
    steps.append("已上传数据包")
    committed = client.post_json(f"/api/admin/v1/problem-drafts/{draft_id}/commit", auth=True)
    problem_id = committed.get("id") or committed.get("problemId")
    steps.append(f"commit 成功，题目 id={problem_id}，状态仍为 DRAFT")
    return {"ok": True, "problemId": problem_id, "draftId": draft_id,
            "warnings": warnings, "steps": steps}


ROUTES = {
    "/api/captcha": handle_captcha,
    "/api/login": handle_login,
    "/api/preflight": handle_preflight,
    "/api/push": handle_push,
}


PAGE_HTML = r'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>QOJ 直传</title>
<style>
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:900px;margin:0 auto;padding:24px;background:#f6f7f9;color:#1d2129}
h1{font-size:20px;margin:0 0 4px}.sub,.muted{color:#86909c;font-size:13px}.card{background:#fff;border:1px solid #e5e6eb;border-radius:8px;padding:16px 18px;margin:16px 0}
h2{font-size:15px;margin:0 0 12px}.row{display:flex;gap:12px;flex-wrap:wrap}.field{flex:1;min-width:200px}label{display:block;font-size:13px;color:#4e5969;margin:8px 0 4px}
input,select{width:100%;padding:8px 10px;border:1px solid #c9cdd4;border-radius:6px;font-size:14px;background:#fff;color:#1d2129}
button{padding:8px 14px;border:0;border-radius:6px;cursor:pointer;background:#165dff;color:#fff}button.secondary{background:#f2f3f5;color:#1d2129;border:1px solid #c9cdd4}
.buttons{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.bundle{border:1px solid #e5e6eb;border-radius:8px;padding:12px;margin:12px 0}.status{font-size:13px;margin-top:8px;white-space:pre-wrap}.ok{color:#00875a}.err{color:#cb2634}.warn{color:#b25e09}
</style></head><body>
<h1>QOJ 直传</h1><div class="sub">problem.json + data.zip → QOJ DRAFT；checkerSource 会随题面一起提交。</div>
<div class="card"><h2>连接与登录</h2><div class="row"><div class="field"><label>base_url</label><input id="base" placeholder="https://your-qoj.example.com"></div><div class="field"><label>角色</label><select id="role"><option>teacher</option><option>admin</option></select></div></div>
<div class="row"><div class="field"><label>用户名</label><input id="user" autocomplete="off"></div><div class="field"><label>密码</label><input id="pass" type="password" autocomplete="off"></div><div class="field"><label>验证码</label><input id="captcha" autocomplete="off"></div></div>
<div class="buttons"><button class="secondary" id="getCaptcha">获取验证码</button><button id="login">登录</button><span class="status" id="loginStatus"></span></div><img id="captchaImage" style="display:none;height:40px;margin-top:8px"></div>
<div class="card"><h2>题目</h2><div class="muted">每行选择配套的 problem.json 和 data.zip；构造题需在 problem.json 提供 checkerSource。</div><div id="bundles"></div>
<div class="buttons"><button class="secondary" id="add">添加题目</button><button class="secondary" id="preflightAll">全部 preflight</button><button id="pushAll">全部上传（DRAFT）</button></div></div>
<script>
const token=new URLSearchParams(location.search).get("token")||"";let captchaId="",seq=0;
const $=id=>document.getElementById(id),api=async(path,body)=>fetch(path,{method:"POST",headers:{"Content-Type":"application/json","X-QOJ-Token":token},body:JSON.stringify(body||{})}).then(r=>r.json());
const read=(file,kind)=>new Promise((resolve,reject)=>{const f=new FileReader();f.onload=()=>resolve(f.result);f.onerror=()=>reject(f.error);kind?f.readAsDataURL(file):f.readAsText(file)});
function esc(s){return String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}
function render(d){let s="";(d.warnings||[]).forEach(x=>s+='<div class="warn">[warn] '+esc(x)+'</div>');(d.errors||[]).forEach(x=>s+='<div class="err">[error] '+esc(x)+'</div>');return s}
function addBundle(){const d=document.createElement("div");d.className="bundle";d.innerHTML='<div class="row"><div class="field"><label>problem.json</label><input class="json" type="file" accept=".json,application/json"></div><div class="field"><label>data.zip</label><input class="zip" type="file" accept=".zip,application/zip"></div><div style="min-width:170px"><label>发布选项</label><label><input class="construction" type="checkbox" style="width:auto"> 构造题</label></div></div><div class="buttons"><button class="secondary pre">preflight</button><button class="push">上传（DRAFT）</button><button class="secondary del">删除</button></div><div class="status"></div>';$("bundles").appendChild(d);d.querySelector(".del").onclick=()=>d.remove();d.querySelector(".pre").onclick=()=>pre(d);d.querySelector(".push").onclick=()=>push(d);return d}
async function files(d){const j=d.querySelector(".json").files[0],z=d.querySelector(".zip").files[0];if(!j||!z)throw Error("请选择 problem.json 和 data.zip");const b=await read(z,true);return{problemJson:await read(j,false),dataZipB64:b.split(",")[1],zipName:z.name,construction:d.querySelector(".construction").checked}}
async function pre(d){const s=d.querySelector(".status");s.textContent="校验中…";try{const r=await files(d),x=await api("/api/preflight",r);s.innerHTML=(x.ok?'<span class="ok">preflight 通过：'+esc(x.title||"")+'（'+x.caseCount+' 个用例）</span>':'<span class="err">preflight 未通过</span>')+render(x);return x.ok}catch(e){s.innerHTML='<span class="err">'+esc(e.message)+'</span>';return false}}
async function push(d){const s=d.querySelector(".status");s.textContent="上传中…";try{const r=await files(d);const x=await api("/api/push",{baseUrl:$("base").value.trim(),...r});if(x.ok){s.innerHTML=(x.steps||[]).map(y=>'<div class="ok">✓ '+esc(y)+'</div>').join("")+ '<div class="ok">请到后台核对后手动发布。</div>'}else{s.innerHTML=render(x)||'<span class="err">上传失败</span>'}}catch(e){s.innerHTML='<span class="err">'+esc(e.message)+'</span>'}}
$("getCaptcha").onclick=async()=>{const b=$("base").value.trim();if(!b){$("loginStatus").textContent="先填写 base_url";return}$("loginStatus").textContent="拉取中…";try{const x=await api("/api/captcha",{baseUrl:b});if(x.error)throw Error(x.error);captchaId=x.captchaId;$("captchaImage").src=x.image;$("captchaImage").style.display="block";$("loginStatus").textContent="验证码已刷新"}catch(e){$("loginStatus").textContent=e.message}};
$("login").onclick=async()=>{try{if(!captchaId)throw Error("请先获取验证码");const x=await api("/api/login",{baseUrl:$("base").value.trim(),role:$("role").value,username:$("user").value,password:$("pass").value,captchaId,captcha:$("captcha").value});if(!x.ok)throw Error(x.error||"登录失败");$("loginStatus").textContent="登录成功，凭证已缓存"}catch(e){$("loginStatus").textContent=e.message}};
$("add").onclick=addBundle;$("preflightAll").onclick=async()=>{for(const d of document.querySelectorAll(".bundle"))await pre(d)};$("pushAll").onclick=async()=>{for(const d of document.querySelectorAll(".bundle"))await push(d)};addBundle();
</script></body></html>'''


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "qoj-web/1.0"

    def _host_ok(self):
        host = (self.headers.get("Host") or "").split(":", 1)[0]
        return host in ("127.0.0.1", "localhost")

    def _json(self, status, value):
        raw = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if not self._host_ok():
            self._json(403, {"error": "非法 Host 头"})
            return
        if self.path.split("?", 1)[0] == "/":
            raw = PAGE_HTML.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        if not self._host_ok():
            self._json(403, {"error": "非法 Host 头"})
            return
        if self.headers.get("X-QOJ-Token") != SESSION_TOKEN:
            self._json(403, {"error": "会话令牌无效"})
            return
        handler = ROUTES.get(self.path.split("?", 1)[0])
        if handler is None:
            self._json(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            self._json(400, {"error": "bad Content-Length"})
            return
        if length > MAX_BODY_BYTES:
            self._json(413, {"error": "请求体过大"})
            return
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
            self._json(200, handler(body))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._json(400, {"error": "请求体不是合法 JSON"})
        except qp.QojError as exc:
            self._json(200, {"ok": False, "error": str(exc)})
        except Exception as exc:  # network and backend errors are shown in the UI
            self._json(200, {"ok": False, "error": f"{type(exc).__name__}: {exc}"})

    def log_message(self, fmt, *args):
        pass


class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


def main(argv=None):
    parser = argparse.ArgumentParser(description="启动本地 QOJ 上传页面")
    parser.add_argument("port", nargs="?", type=int, default=DEFAULT_PORT)
    args = parser.parse_args(argv)
    try:
        server = ThreadingHTTPServer((HOST, args.port), Handler)
    except OSError as exc:
        qp.eprint(f"无法在 {HOST}:{args.port} 起服务：{exc}")
        return 1
    url = f"http://{HOST}:{args.port}/?token={SESSION_TOKEN}"
    print(f"qoj-web 已启动：{url}")
    print("只监听本机；题目将建为 DRAFT，需人工在后台发布。")
    threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
