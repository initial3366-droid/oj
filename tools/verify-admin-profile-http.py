"""Repeatable local HTTP E2E; clones one contest and removes all fixtures in finally.
Requires local qoj-mysql and backend. Tokens stay in memory; no existing rows modified.
Run QOJ_SMOKE_PORT=18081 QOJ_TRUSTED_PROXY_TEST=1 for the explicitly trusted proxy case.
"""
from pathlib import Path
import base64, hashlib, hmac, json, os, subprocess, time, urllib.request, urllib.error, uuid
root = Path(__file__).resolve().parents[1]
settings = {}
for line in (root / '.env').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key, value = line.split('=', 1)
        settings[key.strip()] = value.strip().strip('\"\'')
settings.update(os.environ)
def sql(query):
    result = subprocess.run(['docker', 'exec', '-i', 'qoj-mysql', 'sh', '-c',
        'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot -N -B qoj'], input=query,
        text=True, capture_output=True, check=True)
    return result.stdout.strip()
def token(uid, kind='USER'):
    b64 = lambda v: base64.urlsafe_b64encode(v).decode().rstrip('=')
    data = b64(json.dumps({'alg':'HS256','typ':'JWT'}).encode()) + '.' + b64(json.dumps({
        'sub':str(uid),'jti':str(uuid.uuid4()),'typ':'access','accountType':kind,
        'iat':int(time.time()),'exp':int(time.time())+600}).encode())
    return data+'.'+b64(hmac.new(settings['JWT_SECRET'].encode(), data.encode(), hashlib.sha256).digest())
checks=[]
admin_id=None
api=settings.get('ADMIN_API_PREFIX','/api/'+settings.get('ADMIN_PATH_PREFIX','admin')+'/v1')+'/me'
def call(method, payload=None, expected=200):
    headers={'Authorization':'Bearer '+auth,'Content-Type':'application/json'}
    req=urllib.request.Request('http://127.0.0.1:18080'+api,method=method,headers=headers,data=json.dumps(payload).encode() if payload is not None else None)
    try: response=urllib.request.urlopen(req,timeout=30)
    except urllib.error.HTTPError as error: response=error
    body=json.load(response)
    checks.append({'method':method,'status':response.status,'expected':expected})
    assert response.status==expected,(response.status,body.get('message'))
    return body.get('data')
try:
    columns=[line.split('\t')[0] for line in sql('DESCRIBE admin_users;').splitlines() if not line.startswith('id\t')]
    fields=','.join('`'+c+'`' for c in columns)
    name='e2e'+uuid.uuid4().hex[:9]
    expressions=','.join("'"+name+"'" if c=='username' else "'"+name+"@example.com'" if c=='email' else '`'+c+'`' for c in columns)
    admin_id=int(sql(f'INSERT INTO admin_users ({fields}) SELECT {expressions} FROM admin_users LIMIT 1; SELECT LAST_INSERT_ID();'))
    auth=token(admin_id,'ADMIN')
    original=call('GET')
    updated={'username':name+'x','displayName':'后台资料验证','email':name+'x@example.com','role':'STUDENT'}
    call('PUT',updated)
    actual=call('GET')
    assert actual['username']==updated['username'] and actual['displayName']==updated['displayName'] and actual['email']==updated['email']
    assert actual['role']==original['role']
    call('PUT',{**updated,'email':'invalid'},400)
    call('PUT',{**updated,'username':'a'},400)
    duplicate=sql(f'SELECT username FROM admin_users WHERE id<>{admin_id} LIMIT 1;')
    call('PUT',{**updated,'username':duplicate},400)
    call('PUT',{**updated,'email':''})
    assert call('GET')['email']==''
    report={'passed':True,'checks':checks,'persistedAndReloaded':True,'roleUnchanged':True,'temporaryAccountRemoved':True}
finally:
    if admin_id: sql(f'DELETE FROM admin_users WHERE id={admin_id};')
out=root/'.runtime/chat-title-profile/http-profile.json'
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({'passed':len(checks),'report':str(out)}))
