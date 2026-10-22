"""Local HTTP E2E: real database import/export, deterministic archives, no model calls.
Start the local backend, then run python3 tools/verify-polygon-contests.py.
Only synthetic contests/problems created by this run are removed (soft deletion).
"""
from pathlib import Path
import base64, hashlib, hmac, io, json, os, time, urllib.request, urllib.error, uuid, zipfile
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
out = root / '.runtime/polygon-e2e'
out.mkdir(parents=True, exist_ok=True)
settings = {}
for line in (root / '.env').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key, value = line.split('=', 1); settings[key.strip()] = value.strip().strip('\"\'')
settings.update(os.environ)
b64 = lambda v: base64.urlsafe_b64encode(v).decode().rstrip('=')
encoded = b64(json.dumps({'alg':'HS256','typ':'JWT'}).encode()) + '.' + b64(json.dumps({'sub':'1','jti':str(uuid.uuid4()),'typ':'access','accountType':'ADMIN','iat':int(time.time()),'exp':int(time.time())+900}).encode())
token = encoded + '.' + b64(hmac.new(settings.get('JWT_SECRET','change-this-secret-to-at-least-32-bytes').encode(), encoded.encode(), hashlib.sha256).digest())
base = os.environ.get('POLYGON_API_BASE', 'http://127.0.0.1:18080') + settings.get('ADMIN_API_PREFIX','/api/auth_ac/v1')
checks, created, problem_ids = [], [], []

def request(path, method='GET', body=None, content_type=None, auth=True):
    headers = {'Authorization':'Bearer '+token} if auth else {}
    if content_type: headers['Content-Type'] = content_type
    req = urllib.request.Request(base+path, method=method, data=body, headers=headers)
    try: response = urllib.request.urlopen(req, timeout=120)
    except urllib.error.HTTPError as e: response = e
    raw = response.read()
    return response.status, raw if response.headers.get_content_type() == 'application/zip' else json.loads(raw)

def upload(path, data, config=None, expected=200, auth=True):
    boundary = 'qoj-polygon-' + uuid.uuid4().hex
    parts = [f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="fixture.zip"\r\nContent-Type: application/zip\r\n\r\n'.encode()+data+b'\r\n']
    if config is not None: parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="settings"\r\nContent-Type: application/json\r\n\r\n'.encode()+json.dumps(config).encode()+b'\r\n')
    status, result = request(path, 'POST', b''.join(parts)+f'--{boundary}--\r\n'.encode(), 'multipart/form-data; boundary='+boundary, auth)
    assert status == expected, (path, status, result)
    return result.get('data')

checker = '#include "testlib.h"\nint main(int argc,char**argv){registerTestlibCmd(argc,argv);if(ouf.readInt()!=ans.readInt())quitf(_wa,"wrong");quitf(_ok,"ok");}\n'
descriptor = '''<?xml version="1.0" encoding="UTF-8"?><problem short-name="sum"><names><name language="english" value="Sum"/><name language="chinese" value="求和与空白"/></names><statements><statement language="english" type="text/html" path="statements/english/problem.html"/></statements><judging input-file="" output-file=""><testset name="tests"><time-limit>1500</time-limit><memory-limit>268435456</memory-limit><test-count>2</test-count><input-path-pattern>tests/%02d</input-path-pattern><answer-path-pattern>tests/%02d.a</answer-path-pattern><tests><test method="manual" sample="true" points="40"/><test method="generated" points="60"/></tests></testset></judging><assets><checker type="testlib"><source path="files/check.cpp" type="cpp.g++"/></checker></assets></problem>'''
def files_for_problem(base_path='', xml=descriptor):
    return {base_path+'problem.xml':xml, base_path+'statements/english/problem.html':'<html><body><p>Compute $a+b$.</p></body></html>', base_path+'tests/01':b' 1  2\r\n', base_path+'tests/01.a':b'3\r\n', base_path+'tests/02':b'100 200\n', base_path+'tests/02.a':b'300\n', base_path+'files/check.cpp':checker}

def archive(files):
    buf=io.BytesIO()
    with zipfile.ZipFile(buf,'w',zipfile.ZIP_DEFLATED) as z:
        for name,data in files.items(): z.writestr(name,data)
    return buf.getvalue()

single=archive(files_for_problem('outer/'))
multi_files={'outer/contest.xml':'<contest><names><name language="english" value="Polygon E2E"/></names><problems><problem index="B" url="https://polygon.codeforces.com/u/sum-b"/><problem index="A" url="https://polygon.codeforces.com/u/sum-a"/></problems></contest>'}
multi_files.update(files_for_problem('outer/problems/sum-b/'))
multi_files.update(files_for_problem('outer/problems/sum-a/'))
multi=archive(multi_files)
(out/'single.zip').write_bytes(single); (out/'contest.zip').write_bytes(multi)
config={'title':'Polygon E2E '+uuid.uuid4().hex[:8], 'startTime':'2030-01-01T09:00:00','durationMinutes':180,'type':'OI'}

def track(contest_id):
    created.append(contest_id)
    status,detail=request('/contests/'+str(contest_id)); assert status==200
    for p in detail['data']['problems']:
        if p.get('problemId'):
            problem_ids.append(p['problemId'])
            status,problem=request('/problems/'+str(p['problemId'])); assert status==200
            assert problem['data']['accessScope']=='PRIVATE' and not problem['data']['isPublic'] and problem['data']['studentPublishStatus']=='DRAFT'
    return detail['data']

try:
    preview=upload('/contests/polygon/preview',single)
    assert preview['problems'][0]['testCount']==2 and preview['problems'][0]['memoryLimit']==256 and preview['problems'][0]['sampleCount']==1
    assert preview['problems'][0]['title']=='求和与空白'
    checks.append('单题、外层目录、中文题名、单位及样例识别')
    preview=upload('/contests/polygon/preview',multi)
    assert [p['label'] for p in preview['problems']]==['B','A']
    checks.append('比赛清单顺序、标签与远程 URL 本地匹配')
    latex=files_for_problem()
    del latex['statements/english/problem.html']
    latex['statements/english/legend.tex']='Compute $a+b$.'
    preview=upload('/contests/polygon/preview',archive(latex))
    assert any('LaTeX' in w for w in preview['warnings'])
    checks.append('LaTeX 题面回退并明确提示排版需求')
    images=files_for_problem()
    images['statements/english/problem.html']='<html><body><img src="pic.png"/></body></html>'
    images['statements/english/pic.png']=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=')
    upload('/contests/polygon/preview',archive(images))
    checks.append('本地题面图片可内嵌导入')
    upload('/contests/polygon/preview',archive(files_for_problem(xml=descriptor.replace('points="40"','points="40.0"'))))
    checks.append('整数形式的小数计分（40.0）兼容')
    invalids={
      '缺少答案':{k:v for k,v in files_for_problem().items() if k!='tests/02.a'},
      'XML外部实体':files_for_problem(xml=descriptor.replace('<problem ', '<!DOCTYPE problem [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><problem ',1)),
      '交互题':files_for_problem(xml=descriptor.replace('<assets>','<assets><interactor/>')),
      '文件IO':files_for_problem(xml=descriptor.replace('input-file=""','input-file="input.txt"')),
      '分组计分':files_for_problem(xml=descriptor.replace('<test-count>','<groups/><test-count>')),
      '非整数分数':files_for_problem(xml=descriptor.replace('points="40"','points="1.5"')),
      '部分缺失分数':files_for_problem(xml=descriptor.replace(' points="60"','')),
      '测试数量不符':files_for_problem(xml=descriptor.replace('<test-count>2','<test-count>3')),
      '路径占位符异常':files_for_problem(xml=descriptor.replace('tests/%02d</input','tests/%999999999d</input')),
      '内存无法无损转换':files_for_problem(xml=descriptor.replace('268435456','268435455')),
      '缺少checker':{k:v for k,v in files_for_problem().items() if k!='files/check.cpp'},
      '缺少题面':{k:v for k,v in files_for_problem().items() if not k.endswith('.html')},
      'ZIP路径穿越':{**files_for_problem(),'../outside':'unsafe'},
      'UTF8损坏':{**files_for_problem(),'tests/01':b'\xff'},
      '压缩炸弹单文件':{**files_for_problem(),'oversize':b'0'*(16*1024*1024+1)},
    }
    for name,files in invalids.items():
        upload('/contests/polygon/preview',archive(files),expected=400)
        checks.append('拒绝：'+name)
    duplicate=io.BytesIO()
    with zipfile.ZipFile(duplicate,'w') as z:
        z.writestr('problem.xml',descriptor)
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter('ignore'); z.writestr('problem.xml',descriptor)
    upload('/contests/polygon/preview',duplicate.getvalue(),expected=400)
    checks.append('拒绝：ZIP重复文件')
    upload('/contests/polygon/preview',single,expected=401,auth=False)
    checks.append('未登录禁止导入')
    admin_token=token
    status,users=request('/users?page=1&pageSize=100'); assert status==200
    student=next(u for u in users['data']['list'] if u.get('role')=='STUDENT' and u.get('status')!='BANNED')
    encoded_user=b64(json.dumps({'alg':'HS256','typ':'JWT'}).encode())+'.'+b64(json.dumps({'sub':str(student['id']),'jti':str(uuid.uuid4()),'typ':'access','accountType':'USER','iat':int(time.time()),'exp':int(time.time())+300}).encode())
    token=encoded_user+'.'+b64(hmac.new(settings.get('JWT_SECRET','change-this-secret-to-at-least-32-bytes').encode(),encoded_user.encode(),hashlib.sha256).digest())
    upload('/contests/polygon/preview',single,expected=403)
    token=admin_token
    checks.append('普通用户禁止导入')
    upload('/contests/polygon/import',single,expected=400)
    checks.append('缺少导入配置返回明确400')
    imported=upload('/contests/polygon/import',multi,config)
    detail=track(imported['contestId'])
    assert detail['title']==config['title'] and detail['type']=='OI' and len(detail['problems'])==2
    status,exported=request('/contests/'+str(imported['contestId'])+'/polygon/export'); assert status==200
    (out/'exported.zip').write_bytes(exported)
    with zipfile.ZipFile(io.BytesIO(exported)) as z:
        manifest=ET.fromstring(z.read('contest.xml'))
        assert [p.attrib['index'] for p in manifest.find('problems')]==['B','A']
        assert z.read('problems/B/tests/001')==b' 1  2\r\n' and z.read('problems/B/tests/002.a')==b'300\n'
        assert z.read('problems/B/files/check.cpp').decode()==checker
        desc=ET.fromstring(z.read('problems/B/problem.xml'))
        assert [t.attrib['points'] for t in desc.find('judging/testset/tests')]==['40','60']
        assert json.loads(z.read('problems/B/qoj-samples.json'))[0]['output']=='3\r\n'
    checks.append('真实数据库导入并导出：顺序、测试原始字节、checker、分数及样例')
    checks.append('导入题目保持私有且未发布')
    again=upload('/contests/polygon/import',exported,{**config,'title':config['title']+' roundtrip'})
    track(again['contestId'])
    status,roundtrip=request('/contests/'+str(again['contestId'])+'/polygon/export'); assert status==200
    with zipfile.ZipFile(io.BytesIO(exported)) as a, zipfile.ZipFile(io.BytesIO(roundtrip)) as b:
        for path in a.namelist():
            if path!='contest.xml': assert a.read(path)==b.read(path), path
    checks.append('导出再导入：全部题目文件逐字节一致')
    before=request('/problems?page=1&pageSize=1')[1]['data']['total']
    bad=files_for_problem();bad['tests/02.a']=b'\xff'
    upload('/contests/polygon/import',archive(bad),config,expected=400)
    after=request('/problems?page=1&pageSize=1')[1]['data']['total']; assert before==after
    checks.append('无效导入不留下题目')
    status,_=request('/contests/'+str(imported['contestId'])+'/polygon/export',auth=False); assert status==401
    checks.append('未登录不能下载隐藏测试')
    token=encoded_user+'.'+b64(hmac.new(settings.get('JWT_SECRET','change-this-secret-to-at-least-32-bytes').encode(),encoded_user.encode(),hashlib.sha256).digest())
    status,_=request('/contests/'+str(imported['contestId'])+'/polygon/export'); assert status==403
    token=admin_token
    checks.append('普通用户不能下载隐藏测试')
    (out/'report.json').write_text(json.dumps({'passed':True,'checks':checks,'exportSha256':hashlib.sha256(exported).hexdigest()},ensure_ascii=False,indent=2))
    print(json.dumps({'passed':len(checks),'report':str(out/'report.json')},ensure_ascii=False))
finally:
    if os.environ.get('POLYGON_KEEP_FIXTURES'):
        (out/'created.json').write_text(json.dumps({'contestIds':created,'problemIds':problem_ids}))
    else:
        for contest_id in created: request('/contests/'+str(contest_id),'DELETE')
        for problem_id in set(problem_ids): request('/problems/'+str(problem_id),'DELETE')
