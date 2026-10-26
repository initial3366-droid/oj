"""Real HTTP E2E for the shared student batch service and admin password rejection.
Run with the local backend on 18080 and qoj-mysql. Optional:
QOJ_E2E_ADMIN_OPERATION_PASSWORD verifies admin success using its real operation password.
Only dedicated fixtures are changed. Report: output/student-batch-audit/report.json.
"""
from pathlib import Path
import os,subprocess,uuid,json,base64,hmac,hashlib,time,urllib.request,urllib.error
root=Path(__file__).resolve().parents[1];env={}
for l in (root/'.env').read_text().splitlines():
 if '=' in l and not l.startswith('#'):
  k,v=l.split('=',1);env[k]=v.strip().strip('\"\'')
def sql(q):
 return subprocess.run(['docker','exec','-i','qoj-mysql','sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -N -B qoj'],input=q,text=True,capture_output=True,check=True).stdout.strip()
def token(uid,kind,ph):
 b=lambda x:base64.urlsafe_b64encode(x).decode().rstrip('=')
 secret=env['JWT_SECRET'].encode()
 cred=b(hmac.new(secret,f'{kind}:{uid}:{ph}'.encode(),hashlib.sha256).digest())
 data=b(b'{"alg":"HS256","typ":"JWT"}')+'.'+b(json.dumps(dict(sub=str(uid),typ='access',accountType=kind,credential=cred,iat=int(time.time()),exp=int(time.time())+600,jti=str(uuid.uuid4()))).encode())
 return data+'.'+b(hmac.new(secret,data.encode(),hashlib.sha256).digest())
def call(path,payload,tok,method='POST'):
 req=urllib.request.Request('http://127.0.0.1:18080'+path,data=json.dumps(payload).encode() if payload is not None else None,headers={'Content-Type':'application/json','Authorization':'Bearer '+tok},method=method)
 try:r=urllib.request.urlopen(req)
 except urllib.error.HTTPError as e:r=e
 return r.status,json.load(r)
checks=[]
name='batchaudit'+uuid.uuid4().hex[:10]
admin=teacher=room=other_room=None
students=[]
problem_ids=[]
report={'passed':False,'checks':checks,'scope':'local HTTP + MySQL + Redis'}
def check(label,condition,details=None):
 checks.append({'name':label,'passed':bool(condition),'details':details})
 assert condition,(label,details)
def create_student(suffix):
 uid=int(sql(f"INSERT INTO users(username,password_hash,role,display_name,class_id) VALUES('{name}{suffix}','test-fixture','STUDENT','audit',{room}); SELECT LAST_INSERT_ID();"))
 students.append(uid)
 sql(f"INSERT INTO class_members(class_id,user_id,source,joined_at) VALUES({room},{uid},'ADMIN',NOW()); INSERT INTO user_scores(user_id) VALUES({uid});")
 return uid
def batch(label,ids,action,status=200,**extra):
 data=dict(userIds=ids,action=action,**extra)
 if operation_password:
  path=admin_prefix+'/users/batch';auth=admin_token;data['adminPassword']=operation_password
 else:path='/api/teacher/v1/students/batch';auth=teacher_token
 code,body=call(path,data,auth)
 check(label,code==status,{'status':code,'message':body.get('message')})
 return body
operation_password=os.environ.get('QOJ_E2E_ADMIN_OPERATION_PASSWORD')
admin_prefix=env.get('ADMIN_API_PREFIX','/api/admin/v1')
report['successPath']='admin' if operation_password else 'teacher (shared batch service); admin password success not tested'
try:
 admin=int(sql(f"INSERT INTO admin_users(username,password_hash,role,display_name) VALUES('{name}','test-fixture','SUPER_ADMIN','audit'); SELECT LAST_INSERT_ID();"))
 teacher=int(sql(f"INSERT INTO teachers(username,password_hash,display_name,major_id) SELECT '{name}','test-fixture','audit',id FROM majors LIMIT 1; SELECT LAST_INSERT_ID();"))
 assert teacher>0,'A local major fixture is required'
 room=800000000+teacher*2;other_room=room+1
 sql(f"INSERT INTO classes(id,name,teacher_id) VALUES({room},'{name}',{teacher}),({other_room},'{name}other',{teacher});")
 admin_token=token(admin,'ADMIN','test-fixture');teacher_token=token(teacher,'TEACHER','test-fixture')
 first=create_student('a');second=create_student('b')
 for action in ['ASSIGN_CLASS','REMOVE_CLASS','RESET_PASSWORD','RESET_AI_QUOTA','DELETE']:
  for password in [None,'invalid-password']:
   code,body=call(admin_prefix+'/users/batch',dict(userIds=[first],action=action,adminPassword=password),admin_token)
   # Limit attempts are intentionally reset for the dedicated temporary account only.
   check(f'{action}: rejects '+('missing' if password is None else 'wrong')+' operation password',code==403,{'status':code,'message':body.get('message')})
   subprocess.run(['docker','exec','qoj-redis','sh','-c','REDISCLI_AUTH="$1" redis-cli DEL "$2"','sh',env.get('REDIS_PASSWORD','qoj-redis-change-me-2026'),f'oj:admin:operation-password:attempts:{admin}'],check=True,capture_output=True)
 check('wrong password left selected student unchanged',sql(f'SELECT COUNT(*) FROM users WHERE id={first}')=='1')
 batch('unknown action',[first],'UNKNOWN',400)
 batch('missing student rejects entire batch',[first,999999999],'DELETE',400)
 check('mixed invalid batch retained first student',sql(f'SELECT COUNT(*) FROM users WHERE id={first}')=='1')
 batch('invalid target class',[first],'ASSIGN_CLASS',400,classId=999999999)
 batch('short new password',[first],'RESET_PASSWORD',400,password='123')
 batch('reset selected AI quota',[first],'RESET_AI_QUOTA')
 batch('reset selected password',[first],'RESET_PASSWORD',password='audit-temp-password')
 check('new password persisted',sql(f'SELECT password_hash FROM users WHERE id={first}')!='test-fixture')
 check('unselected password unchanged',sql(f'SELECT password_hash FROM users WHERE id={second}')=='test-fixture')
 batch('move selected student',[first],'ASSIGN_CLASS',classId=other_room)
 check('membership synchronized',sql(f'SELECT class_id FROM class_members WHERE user_id={first}')==str(other_room) and sql(f'SELECT class_id FROM users WHERE id={first}')==str(other_room))
 batch('remove selected student from class',[first],'REMOVE_CLASS')
 check('membership removed',sql(f'SELECT COUNT(*) FROM class_members WHERE user_id={first}')=='0' and sql(f'SELECT class_id IS NULL FROM users WHERE id={first}')=='1')
 # Reattach only our fixture so the teacher can continue managing it.
 sql(f"INSERT INTO class_members(class_id,user_id,source,joined_at) VALUES({room},{first},'ADMIN',NOW()); UPDATE users SET class_id={room} WHERE id={first};")
 # Shared content owned by a later id must roll back deletion of an earlier id.
 problem=900000000+teacher;problem_ids.append(problem)
 sql(f"INSERT INTO problems(id,title,statement,difficulty,time_limit,memory_limit,owner_id,owner_account_type) VALUES({problem},'audit','audit',1,1000,128,{second},'USER');")
 batch('shared content blocks entire delete batch',[first,second],'DELETE',400)
 check('both students and scores survived rollback',sql(f'SELECT COUNT(*) FROM users WHERE id IN ({first},{second})')=='2' and sql(f'SELECT COUNT(*) FROM user_scores WHERE user_id IN ({first},{second})')=='2')
 # An ADMIN with the same numeric id is a separate content owner.
 sql(f"UPDATE problems SET owner_account_type='ADMIN' WHERE id={problem};")
 sql(f"INSERT INTO submissions(user_id,problem_id,code,language,status) VALUES({first},{problem},'audit','cpp','ACCEPTED');")
 submission=int(sql(f'SELECT id FROM submissions WHERE user_id={first} LIMIT 1'))
 sql(f"INSERT INTO user_problem_status(user_id,problem_id,last_submission_id,best_status,last_status) VALUES({first},{problem},{submission},'ACCEPTED','ACCEPTED'); INSERT INTO submission_case_results(submission_id,case_no,status) VALUES({submission},1,'ACCEPTED');")
 batch('delete students with submission history',[first,second],'DELETE')
 for table,column in [('users','id'),('user_scores','user_id'),('class_members','user_id'),('submissions','user_id'),('user_problem_status','user_id')]:
  check('cascade cleaned '+table,sql(f'SELECT COUNT(*) FROM {table} WHERE {column} IN ({first},{second})')=='0')
 check('cascade cleaned submission case results',sql(f'SELECT COUNT(*) FROM submission_case_results WHERE submission_id={submission}')=='0')
 check('shared ADMIN content retained',sql(f'SELECT COUNT(*) FROM problems WHERE id={problem}')=='1')
 report['passed']=True
finally:
 for pid in problem_ids:
  sql(f'DELETE FROM user_problem_status WHERE problem_id={pid}; DELETE FROM submissions WHERE problem_id={pid}; DELETE FROM problems WHERE id={pid};')
 for uid in students:sql(f'DELETE FROM users WHERE id={uid}')
 if room:sql(f'DELETE FROM classes WHERE id IN ({room},{other_room})')
 if teacher:sql(f'DELETE FROM teachers WHERE id={teacher}')
 if admin:sql(f'DELETE FROM admin_users WHERE id={admin}')
 report['fixtureUsersRemaining']=int(sql(f"SELECT COUNT(*) FROM users WHERE username LIKE '{name}%';"))
 out=root/'output/student-batch-audit/report.json';out.parent.mkdir(parents=True,exist_ok=True)
 out.write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(json.dumps({'passed':report['passed'],'checks':len(checks),'report':str(out)},ensure_ascii=False))
