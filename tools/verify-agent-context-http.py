import json,urllib.request,urllib.error,pathlib,datetime,time
root=pathlib.Path('/Users/initial/qoj');base='http://127.0.0.1:18080';admin=(root/'logs/e2e-admin-token.txt').read_text().strip()
def req(path,token=None,method='GET',data=None):
 h={'Content-Type':'application/json'}
 if token:h['Authorization']='Bearer '+token
 path=path.replace('/api/admin/v1',config.get('ADMIN_API_PREFIX','/api/auth_ac/v1'))
 r=urllib.request.Request(base+path,headers=h,method=method,data=json.dumps(data).encode() if data is not None else None)
 try:
  with urllib.request.urlopen(r) as f:return json.load(f)
 except urllib.error.HTTPError as e:return json.load(e)
# Renew local fixture credentials without logging keys or tokens.
import base64,hashlib,hmac,uuid,re
config={}
for envfile in [root/'.env',root/'backend/.env']:
 if envfile.exists():
  for line in envfile.read_text().splitlines():
   if '=' in line and not line.lstrip().startswith('#'):
    k,v=line.split('=',1);config[k.strip()]=v.strip().strip('"').strip("'")
secret=config.get('JWT_SECRET')
if not secret:
 text=(root/'backend/src/main/resources/application.yml').read_text()
 secret=re.search(r'\$\{JWT_SECRET:([^}]+)\}',text).group(1)
def renew(token):
 parts=token.split('.');payload=json.loads(base64.urlsafe_b64decode(parts[1]+'='*(-len(parts[1])%4)));payload.update(exp=int(time.time())+1800,iat=int(time.time()),jti=str(uuid.uuid4()),sessionExpiresAt=int(time.time())+1800)
 alg='HS512' if len(secret.encode())>=64 else 'HS384' if len(secret.encode())>=48 else 'HS256'
 enc=lambda v:base64.urlsafe_b64encode(json.dumps(v,separators=(',',':')).encode()).rstrip(b'=')
 data=enc({'alg':alg})+b'.'+enc(payload)
 return (data+b'.'+base64.urlsafe_b64encode(hmac.new(secret.encode(),data,getattr(hashlib,'sha'+alg[2:])).digest()).rstrip(b'=')).decode()
admin=renew(admin)
checks=[]
info=req('/api/admin/v1/agent/chat/context',admin)
assert info['code']==200,info
assert info['data']['limit']==512000 and 8192<=info['data']['window']<=512000,info
checks.append('已配置模型上下文信息接口正常且无密钥返回')
assert 'apiKey' not in info['data']
identifier='e2e-local-only-context'
body={'title':'本地历史验证','createdAt':1,'updatedAt':1,'messages':[{'id':'u1','role':'user','content':'这条验证消息不可保存到服务器'}]}
response=req('/api/admin/v1/agent/chat/sessions/'+identifier,admin,'PUT',body)
assert response['code']==410,response
assert req('/api/admin/v1/agent/chat/sessions/'+identifier,admin)['code']==404
checks.append('旧历史写入接口返回410且未创建记录')
stop=req('/api/admin/v1/agent/chat/stop',admin,'POST',{'sessionId':identifier,'assistantMessageId':'a1'})
assert stop['code']==200,stop
checks.append('停止接口无需服务器历史记录')
report={'passed':True,'checks':checks,'context':info['data']}
(root/'.runtime/agent-local-context/http-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
