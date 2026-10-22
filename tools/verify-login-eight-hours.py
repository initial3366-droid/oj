"""HTTP E2E: temporary local user; verifies real login and refresh for both modes."""
from pathlib import Path
import base64, bcrypt, json, os, secrets, subprocess, time, urllib.request, uuid
root=Path(__file__).resolve().parents[1]
base=os.environ.get('QOJ_HTTP_BASE','http://127.0.0.1:18080')
def sql(query):
    return subprocess.run(['docker','exec','-i','qoj-mysql','sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot -N -B qoj'],input=query,text=True,capture_output=True,check=True).stdout.strip()
def post(path,body,token=None):
    headers={'Content-Type':'application/json'}
    if token:headers['Authorization']='Bearer '+token
    with urllib.request.urlopen(urllib.request.Request(base+path,data=json.dumps(body).encode(),headers=headers),timeout=30) as response:
        data=json.load(response)
    assert data['code']==200
    return data.get('data')
def claims(token):
    part=token.split('.')[1]
    return json.loads(base64.urlsafe_b64decode(part+'='*(-len(part)%4)))
username='e2e'+uuid.uuid4().hex[:10]
password=secrets.token_urlsafe(16)
hashed=bcrypt.hashpw(password.encode(),bcrypt.gensalt()).decode()
uid=None;checks=[];sessions=[]
try:
    uid=int(sql(f"INSERT INTO users(username,password_hash,role,display_name,email) VALUES('{username}','{hashed}','STUDENT','八小时会话验证','{username}@example.invalid'); SELECT LAST_INSERT_ID();"))
    for remember in [False,True]:
        before=int(time.time())
        tokens=post('/api/v1/auth/login',{'username':username,'password':password,'rememberMe':remember})
        sessions.append(tokens)
        after=int(time.time())
        access,refresh=claims(tokens['accessToken']),claims(tokens['refreshToken'])
        deadline=refresh['sessionExpiresAt']
        assert before+28800<=deadline<=after+28800
        assert access['sessionExpiresAt']==deadline and access['exp']<=deadline
        assert refresh['exp']==deadline
        rotated=post('/api/v1/auth/refresh',{'refreshToken':tokens['refreshToken']})
        sessions[-1]=rotated
        assert claims(rotated['refreshToken'])['sessionExpiresAt']==deadline
        assert claims(rotated['accessToken'])['sessionExpiresAt']==deadline
        assert rotated['refreshToken']!=tokens['refreshToken']
        checks.append({'rememberMe':remember,'sessionHours':8,'accessBoundedBySession':True,'refreshPreservesDeadline':True,'refreshRotated':True})
finally:
    try:
        for tokens in sessions:
            post('/api/v1/auth/logout',{'refreshToken':tokens['refreshToken']},tokens['accessToken'])
    finally:
        if uid:sql(f'DELETE FROM users WHERE id={uid};')
out=root/'.runtime/login-eight-hours';out.mkdir(parents=True,exist_ok=True)
(out/'report.json').write_text(json.dumps({'passed':True,'checks':checks,'temporaryUserRemoved':True},ensure_ascii=False,indent=2))
print(json.dumps({'passed':True,'checks':checks,'report':str(out/'report.json')},ensure_ascii=False))
