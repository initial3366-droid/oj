"""Teacher parity E2E extension; uses the disposable Lanqiao harness, never the main DB.
Run: QOJ_TEACHER_PARITY=1 QOJ_E2E_OUTPUT=artifacts/teacher-parity python3 tools/verify-lanqiao-contest-http.py
"""
import csv
import io
import json
import os
import subprocess
import urllib.request
import urllib.parse
import uuid


def verify_parity(root, output, base, prefix, http, sql, check, teacher, admin, student,
                  tid, uid, other, highest, empty, pid, sid, unrelated_cid, cid):
    def raw(path, actor=teacher):
        return urllib.request.urlopen(urllib.request.Request(base + path,
            headers={'Authorization': 'Bearer ' + actor}), timeout=60).read().decode('utf-8-sig')

    def listing(query='', actor=teacher):
        return http(prefix + '/submissions?' + query, token=actor)

    # The contest's existing entrants intentionally do not belong to this teacher's class.
    managed = listing(f'contestId={cid}&pageSize=100')
    assert managed['total'] == 9, managed
    managed_sid = managed['list'][0]['id']
    sql(f"UPDATE submissions SET time_used=12,memory_used=2048,judge_message='Parity verdict' WHERE id={managed_sid};")
    sql(f"INSERT INTO submission_case_results(submission_id,case_no,status,time_used,memory_used,score,max_score) VALUES({managed_sid},1,'AC',12,2048,12,34);")
    detail = http(prefix + f'/submissions/{managed_sid}', token=teacher)
    assert detail['code'] == 'fixture' and detail['cases'][0]['caseNo'] == 1 and detail['score'] is not None
    assert detail['timeUsed'] == 12 and detail['memoryUsed'] == 2048
    assert detail['cases'][0]['score']==12 and detail['cases'][0]['maxScore']==34
    assert http(prefix + f'/submissions/{managed_sid}/code', token=teacher) == 'fixture'
    assert len(list(csv.reader(io.StringIO(raw(prefix + f'/submissions/export?contestId={cid}'))))) == 10
    assert http(prefix+f'/submission-queue?contestId={cid}',token=teacher)['total'] == 9
    http(prefix+f'/submission-queue/{managed_sid}/logs',token=teacher)
    check('teacher sees all own-contest entrants outside classes in list, details, cases, code, CSV and queue')

    for path in [f'/submissions/{sid}', f'/submissions/{sid}/code', f'/submission-queue/{sid}/logs',
                 f'/contests/{unrelated_cid}/messages', f'/submission-queue?contestId={unrelated_cid}']:
        http(prefix+path, token=teacher, expected=40003 if path.startswith('/submission-queue') or path.startswith('/submissions') else 403)
    assert listing(f'contestId={unrelated_cid}')['total'] == 0
    for suffix, method, body in [(f'/submissions/{sid}', 'DELETE', None),
                                 (f'/submissions/{sid}/rejudge','POST',{}),
                                 (f'/submission-queue/{sid}/priority','POST',{'priority':5})]:
        http(prefix+suffix,body=body,token=teacher,method=method,expected=40003)
    http(prefix+f'/contests/{unrelated_cid}/registrations/import',{'studentNos':['none']},teacher,expected=40003)
    http(prefix+f'/submissions/{managed_sid}',token=student,expected=403)
    http(prefix+f'/submissions/{managed_sid}',expected=401)
    check('unrelated teacher resources and student or anonymous management requests remain denied')

    sql(f"INSERT INTO classes(id,name,teacher_id) VALUES(890001,'Parity class',{tid});")
    sql(f"INSERT INTO class_members(class_id,user_id) VALUES(890001,{uid});")
    practice = int(sql(f"INSERT INTO practices(title,owner_id,owner_account_type,audience) VALUES('Parity exercise',{tid},'TEACHER','ALL'); SELECT LAST_INSERT_ID();"))
    # Generate > 1000 submissions; one old keyword match must survive server-side pagination.
    target = int(sql(f"INSERT INTO submissions(user_id,problem_id,practice_id,code,language,status,score,submit_time) VALUES({uid},{pid},{practice},'older matching source','python','WA',17,NOW()-INTERVAL 2 DAY); SELECT LAST_INSERT_ID();"))
    values=','.join(f"({uid},{pid},{practice},'bulk fixture','cpp17','AC',100,NOW())" for _ in range(1005))
    sql('INSERT INTO submissions(user_id,problem_id,practice_id,code,language,status,score,submit_time) VALUES'+values+';')
    all_practice=listing('practiceOnly=true&pageSize=10')
    assert all_practice['total'] == 1006 and len(all_practice['list']) == 10
    assert listing('practiceOnly=true&page=101&pageSize=10')['list']
    selected=listing('practiceOnly=true&language=python&pageSize=10')
    assert selected['total'] == 1 and selected['list'][0]['id'] == target
    keyword=urllib.parse.quote('Parity exercise')
    filtered=listing(f'practiceOnly=true&keyword={keyword}&language=python')
    assert filtered['total']==1 and filtered['list'][0]['id']==target
    assert http('/api/teacher/v1/submissions?practiceOnly=true&language=python',token=teacher)['total']==1
    assert len(list(csv.reader(io.StringIO(raw('/api/teacher/v1/submissions/export?practiceOnly=true&language=python')))))==2
    for search in ['sandbox_e2e','Management 70','Privacy fixture',str(target)]:
        assert listing('practiceOnly=true&language=python&keyword='+urllib.parse.quote(search))['total']==1, search
    exported=list(csv.reader(io.StringIO(raw(prefix+f'/submissions/export?practiceOnly=true&keyword={keyword}&language=python'))))
    assert len(exported)==2 and int(exported[1][0])==target
    assert listing('keyword='+urllib.parse.quote("' OR 1=1 --"))['total']==0
    check('server pagination retains 1006 practice records; old-row keyword, language, student, problem and CSV filters agree')

    sql(f"UPDATE users SET student_no='PARITY-IMPORT' WHERE id={empty};")
    sql(f"DELETE FROM contest_registrations WHERE contest_id={cid} AND user_id={empty};")
    result=http(prefix+f'/contests/{cid}/registrations/import',{'studentNos':['PARITY-IMPORT','PARITY-IMPORT','UNKNOWN-PARITY']},teacher)
    assert (result['addedCount'],result['skippedCount'],result['failedCount'])==(1,1,1),result
    # UI independently covers file upload with a second registered entrant.
    sql(f"UPDATE users SET student_no='PARITY-FILE' WHERE id={highest};")
    sql(f"DELETE FROM contest_registrations WHERE contest_id={cid} AND user_id={highest};")
    message=http(prefix+f'/contests/{cid}/messages/broadcast',{'content':'HTTP parity broadcast','requestId':str(uuid.uuid4())},teacher)
    reply=http(prefix+f'/contests/{cid}/messages/reply',{'content':'HTTP parity reply','participantId':uid,'requestId':str(uuid.uuid4())},teacher)
    feed=http(prefix+f'/contests/{cid}/messages',token=teacher)
    assert {message['id'],reply['id']} <= {item['id'] for item in feed['messages']}
    check('teacher imports roster with duplicate and unknown handling, broadcasts and replies with durable feed')

    http(prefix+f'/submission-queue/{managed_sid}/priority',{'priority':13},teacher)
    assert http(prefix+f'/submission-queue/{managed_sid}',token=teacher)['priority']==13
    # Rejudge only a dedicated disposable row; preserve the scoreboard fixture rows.
    operation=int(sql(f"INSERT INTO submissions(user_id,problem_id,contest_id,contest_problem_id,code,language,status,score) SELECT user_id,problem_id,contest_id,contest_problem_id,'operation fixture','cpp17','WA',0 FROM submissions WHERE id={managed_sid}; SELECT LAST_INSERT_ID();"))
    http(prefix+f'/submission-queue/{operation}/rejudge',{},teacher)
    sql(f"UPDATE submissions SET status='PENDING',judge_worker_id=NULL,judge_retry_after=NOW()+INTERVAL 1 DAY WHERE id={operation};")
    assert http(prefix+f'/submission-queue/{operation}/cancel',{},teacher)['status']=='FAILED'
    http(prefix+f'/submissions/{operation}/rejudge',{},teacher)
    http(prefix+f'/submissions/{operation}',token=teacher,method='DELETE')
    assert listing(f'id={operation}')['total']==0
    check('teacher adjusts own-contest queue priority, rejudges and deletes a disposable submission')
    env={**os.environ,'QOJ_API_BASE':base,'QOJ_API_PREFIX':prefix,'QOJ_TEACHER_TOKEN':teacher,
         'QOJ_ADMIN_TOKEN':admin,'QOJ_PARITY_CONTEST_ID':str(cid),'QOJ_PARITY_SUBMISSION_ID':str(managed_sid),
         'QOJ_PARITY_OLD_ID':str(target),'QOJ_PARITY_USER_ID':str(uid),'QOJ_E2E_OUTPUT':str(output)}
    subprocess.run(['node','tools/verify-teacher-management-ui.mjs'],cwd=root,env=env,check=True)
    assert sql(f"SELECT COUNT(*) FROM contest_messages WHERE contest_id={cid} AND content IN ('Browser teacher broadcast','Browser teacher reply') AND author_account_type='TEACHER' AND author_id={tid};")=='2'
    check('real browser teacher routes, details, CSV, filters, roster file, messaging WebSocket, inspection and admin regression')
