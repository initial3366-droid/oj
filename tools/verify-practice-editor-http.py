"""Read-only smoke check of a local running backend; never prints or saves tokens."""
from pathlib import Path
import base64
import hashlib
import hmac
import json
import os
import time
import urllib.error
import urllib.request
import uuid

root = Path(__file__).resolve().parents[1]
settings = {}
for line in (root / '.env').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key, value = line.split('=', 1)
        settings[key.strip()] = value.strip().strip('\"\'')
settings.update(os.environ)
secret = settings.get('JWT_SECRET', 'change-this-secret-to-at-least-32-bytes').encode()
b64 = lambda value: base64.urlsafe_b64encode(value).decode().rstrip('=')
encoded = b64(json.dumps({'alg': 'HS256', 'typ': 'JWT'}).encode()) + '.' + b64(json.dumps({
    'sub': os.environ.get('QOJ_SMOKE_ADMIN_ID', '1'), 'jti': str(uuid.uuid4()),
    'typ': 'access', 'accountType': 'ADMIN', 'iat': int(time.time()), 'exp': int(time.time()) + 300,
}).encode())
token = encoded + '.' + b64(hmac.new(secret, encoded.encode(), hashlib.sha256).digest())
prefix = settings.get('ADMIN_API_PREFIX', '/api/' + settings.get('ADMIN_PATH_PREFIX', 'admin') + '/v1')
port = os.environ.get('QOJ_SMOKE_PORT', '18080')
report = []

def get(suffix, expected=200):
    path = prefix + suffix
    req = urllib.request.Request('http://127.0.0.1:' + port + path, headers={'Authorization': 'Bearer ' + token})
    try:
        response = urllib.request.urlopen(req, timeout=30)
    except urllib.error.HTTPError as error:
        response = error
    body = json.load(response)
    report.append({'path': path, 'status': response.status, 'code': body.get('code')})
    assert response.status == expected, (path, response.status, body.get('message'))
    return body.get('data')

folders = get('/problem-folders/options')
assert isinstance(folders, list)
assert all(set(folder) == {'id', 'name', 'problemCount'} for folder in folders)
practices = get('/practices?page=1&pageSize=1')
if practices['list']:
    practice_id = practices['list'][0]['id']
    detail = get('/practices/' + str(practice_id))
    assert detail['id'] == practice_id and isinstance(detail['problems'], list)
get('/practices/not-a-number', 405)
get('/problem-folders/not-a-number/candidates', 400)
output = root / '.runtime/practice-edit-fix/http-report.json'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps({'readOnly': True, 'checks': report}, ensure_ascii=False, indent=2))
print(json.dumps({'passed': len(report), 'report': str(output)}, ensure_ascii=False))
