"""Real local worker E2E using a disposable hardened container.

Failure cases: policy silently absent; inherited root group; privilege gain;
compiler/JVM breakage; dangerous syscalls accepted; network or host access;
files surviving between jobs. No public server is contacted.
Requires the existing qoj-go-judge image and Docker with cgroup support.
"""
from pathlib import Path
import json
import secrets
import os
import subprocess
import time
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.runtime/security-remediation/sandbox-isolation-report.json'
NAME = 'qoj-sandbox-e2e-' + uuid.uuid4().hex[:8]
TOKEN = secrets.token_hex(24)
checks = []
base = None
cached = []


def docker(*args):
    return subprocess.run(['docker', *args], text=True, capture_output=True, check=True).stdout.strip()


def api(path, body=None, authorized=True, method=None):
    request = urllib.request.Request(base + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'Content-Type': 'application/json',
                 **({'Authorization': 'Bearer ' + TOKEN} if authorized else {})}, method=method)
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def run(args, content=None, compile_out=None, file_ids=None):
    files = {name: {'content': value} for name, value in (content or {}).items()}
    files.update({name: {'fileId': value} for name, value in (file_ids or {}).items()})
    command = {'args': args, 'env': ['PATH=/usr/local/bin:/usr/bin:/bin', 'HOME=/tmp', 'LANG=C.UTF-8'],
        'files': [{'content': ''}, {'name': 'stdout', 'max': 65536}, {'name': 'stderr', 'max': 65536}],
        'cpuLimit': 15000000000, 'clockLimit': 30000000000, 'memoryLimit': 536870912,
        'stackLimit': 67108864, 'procLimit': 64, 'copyIn': files,
        'copyOut': ['stdout', 'stderr'], 'copyOutCached': compile_out or []}
    result = api('/run', {'cmd': [command]})[0]
    cached.extend(result.get('fileIds', {}).values())
    return result


def accepted(result):
    assert result['status'] == 'Accepted' and result['exitStatus'] == 0, result
    return result.get('files', {}).get('stdout', '')


def check(name, evidence):
    checks.append({'name': name, 'passed': True, 'evidence': evidence})


try:
    image = os.environ.get('QOJ_SANDBOX_IMAGE', 'qoj-go-judge:seccomp-1.12.1')
    # Normal verification uses the built image's own policy and entrypoint.
    # A binary override is useful while developing the pinned worker build.
    overrides = []
    worker_prefix = []
    if os.environ.get('QOJ_SECCOMP_BINARY'):
        overrides = [
            '--mount', 'type=bind,src=' + str(ROOT / 'docker/go-judge/seccomp.yaml') + ',dst=/etc/qoj/seccomp.yaml,readonly',
            '--mount', 'type=bind,src=' + str(ROOT / 'docker/go-judge/qoj-entrypoint') + ',dst=/qoj-entrypoint,readonly',
            '--mount', 'type=bind,src=' + str(Path(os.environ['QOJ_SECCOMP_BINARY']).resolve()) + ',dst=/usr/local/bin/go-judge,readonly',
            '--entrypoint', '/bin/sh']
        worker_prefix = ['/qoj-entrypoint']
    docker('run', '-d', '--name', NAME, '--privileged', '--pids-limit=512', '--memory=2g',
        '--cpus=2', '--shm-size=512m', '-p', '127.0.0.1::5050',
        *overrides, image, *worker_prefix, '-http-addr=:5050',
        '-auth-token=' + TOKEN, '-no-fallback', '-container-cred-start=10000',
        '-parallelism=1', '-pre-fork=1', '-silent')
    port = docker('port', NAME, '5050/tcp').rsplit(':', 1)[1]
    base = 'http://127.0.0.1:' + port
    for _ in range(60):
        try:
            config = api('/config')
            break
        except (OSError, ValueError):
            time.sleep(0.5)
    else:
        raise AssertionError('Worker failed to start with the checked-in policy')
    check('cgroup worker starts without fallback', config['runnerConfig']['cgroupControllers'])
    try:
        api('/run', {'cmd': []}, authorized=False)
        raise AssertionError('Unauthenticated execution allowed')
    except urllib.error.HTTPError as error:
        assert error.code == 401
    check('worker execution requires authentication', 401)
    output = accepted(run(['/usr/bin/python3', 'main.py'], {'main.py': '''import os,json
s=dict(line.split(':',1) for line in open('/proc/self/status') if ':' in line)
print(json.dumps({'uid':os.getuid(),'gid':os.getgid(),'groups':os.getgroups(),
 'noNewPrivs':s['NoNewPrivs'].strip(),'seccomp':s['Seccomp'].strip(),'caps':s['CapEff'].strip()}))
'''}))
    identity = json.loads(output)
    assert identity['uid'] != 0 and identity['gid'] != 0 and 0 not in identity['groups'], identity
    assert identity['noNewPrivs'] == '1' and identity['seccomp'] == '2' and int(identity['caps'], 16) == 0, identity
    check('non-root, no root supplementary group, no capabilities, no-new-privileges and seccomp active', identity)
    for language, compiler in [('C', '/usr/bin/gcc'), ('C++', '/usr/bin/g++')]:
        source = '#include <stdio.h>\nint main(){printf("42\\n");return 0;}\n'
        compilation = run([compiler, 'main.c', '-o', 'main'], {'main.c': source}, ['main'])
        accepted(compilation)
        assert accepted(run(['./main'], file_ids={'main': compilation['fileIds']['main']})) == '42\n'
        check(language + ' compiles and runs', '42')
    compilation = run(['/usr/local/bin/qoj-java-compile'], {'Main.java': 'public class Main {public static void main(String[] a){System.out.println(42);}}'}, ['main.jar'])
    accepted(compilation)
    assert accepted(run(['/usr/bin/java', '-Xmx128m', '-XX:CompressedClassSpaceSize=32m', '-XX:MaxMetaspaceSize=64m', '-XX:ReservedCodeCacheSize=32m', '-cp', 'main.jar', 'Main'], file_ids={'main.jar': compilation['fileIds']['main.jar']})) == '42\n'
    check('Java compiler and JVM threads work', '42')
    result = run(['/usr/bin/python3', '-c', 'import ctypes;ctypes.CDLL(None).ptrace(0,0,0,0);print("UNSAFE")'])
    assert result['status'] == 'Dangerous Syscall', result
    check('ptrace terminated by kernel policy', result['status'])
    result = run(['/usr/bin/python3', '-c', 'import ctypes;ctypes.CDLL(None).unshare(0);print("UNSAFE")'])
    assert result['status'] == 'Dangerous Syscall', result
    check('namespace manipulation terminated by kernel policy', result['status'])
    output = accepted(run(['/usr/bin/python3', '-c', '''import socket,errno
s=socket.socket()
try:s.connect(('127.0.0.1',9))
except OSError as e:
 assert e.errno==errno.EPERM,e
 print('network denied')
else:raise AssertionError('network allowed')
''']))
    check('connect denied by seccomp, including loopback', output.strip())
    output = accepted(run(['/usr/bin/python3', '-c', '''import os
assert not os.path.exists('/var/run/docker.sock')
assert not os.path.exists('/host')
assert not os.path.exists('/etc/shadow')
try:open('/usr/qoj-e2e-marker','w')
except OSError:pass
else:raise AssertionError('root filesystem writable')
open('/tmp/qoj-e2e-marker','w').write('temporary')
print('host paths absent and toolchain filesystem read-only')
''']))
    check('host paths inaccessible and root filesystem read-only', output.strip())
    accepted(run(['/usr/bin/python3', '-c', "import os;assert not os.path.exists('/tmp/qoj-e2e-marker');print('isolated')"]))
    check('temporary files do not survive between executions', 'isolated')
    from verify_sandbox_backend import verify
    checks.extend(verify(ROOT, base, TOKEN))
finally:
    try:
        docker('rm', '-f', NAME)
    finally:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        report = {'passed': len(checks) == 18, 'checks': checks,
                  'command': 'python3 tools/verify-sandbox-isolation.py',
                  'image': image, 'binaryOverride': bool(os.environ.get('QOJ_SECCOMP_BINARY')),
                  'scope': 'real worker and business API with disposable database; no public target contacted'}
        OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps({'passed': report['passed'], 'checks': len(checks), 'report': str(OUT)}))
