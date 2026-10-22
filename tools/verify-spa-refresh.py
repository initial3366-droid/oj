"""Repeatable HTTP check against the running backend (no credentials required)."""
import os,json,urllib.request,urllib.error
from pathlib import Path
base=os.environ.get('QOJ_HTTP_BASE','http://127.0.0.1:18080')
prefix=os.environ.get('QOJ_ADMIN_PREFIX','auth_ac')
paths=[f'/{prefix}',f'/{prefix}/problem-folders/new',f'/{prefix}/problem-folders/1',f'/{prefix}/redirect/{prefix}/problem-folders/1','/teacher/problem-folders/1','/courses','/courses/1','/redirect/courses/1','/assets/not-found.js',f'/api/{prefix}/v1/not-found']
results=[]
for path in paths:
 try:r=urllib.request.urlopen(base+path)
 except urllib.error.HTTPError as e:r=e
 body=r.read();results.append({'path':path,'status':r.status,'type':r.headers.get('Content-Type'),'index':b'<!doctype html>' in body.lower()})
asset=next(Path('dist/assets').glob('main-*.js'))
r=urllib.request.urlopen(base+'/assets/'+asset.name)
assert r.status==200 and r.read()==asset.read_bytes()
results.append({'path':'/assets/'+asset.name,'status':200,'assetMatchesBuild':True})
out=Path('.runtime/navigation-audit');out.mkdir(parents=True,exist_ok=True)
(out/'http-after.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results,indent=2))
assert all(x['status']==200 and x['index'] for x in results[:-3])
assert results[-3]['status']==404 and not results[-3]['index']
assert results[-2]['status']==401 and not results[-2]['index']
