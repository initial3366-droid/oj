#!/usr/bin/env python3
"""Build and package QOJ for native MySQL/Redis + systemd/Nginx deployment."""
import argparse
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
from zoneinfo import ZoneInfo
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def configured_prefix():
    prefix = 'admin'
    for name in ['.env', '.env.local', '.env.production', '.env.production.local']:
        path = ROOT / name
        if path.exists():
            for line in path.read_text().splitlines():
                if line.startswith('VITE_ADMIN_PREFIX='):
                    prefix = line.split('=', 1)[1].strip().strip('\"\'')
    return os.environ.get('VITE_ADMIN_PREFIX', prefix)


def check_jar(path, start_class, required_classes):
    with zipfile.ZipFile(path) as archive:
        manifest = archive.read('META-INF/MANIFEST.MF').decode()
        if f'Start-Class: {start_class}' not in manifest or 'Main-Class: org.springframework.boot.loader.launch.JarLauncher' not in manifest:
            raise SystemExit(f'{path.name} 不是预期的 Spring Boot 可执行 JAR')
        for name in required_classes:
            if f'BOOT-INF/classes/{name}.class' not in archive.namelist():
                raise SystemExit(f'{path.name} 缺少最新功能类 {name}')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--admin-prefix', default=configured_prefix())
    parser.add_argument('--skip-build', action='store_true', help='使用刚完成构建的 dist 和 JAR')
    args = parser.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9_-]+', args.admin_prefix):
        raise SystemExit('后台前缀只能包含字母、数字、下划线和短横线')
    api_prefix = f'/api/{args.admin_prefix}/v1'
    if not args.skip_build:
        env = {**os.environ, 'VITE_ADMIN_PREFIX': args.admin_prefix,
            'VITE_ADMIN_API_PREFIX': api_prefix, 'VITE_AGENT_BASE_URL': '/agent'}
        subprocess.run(['npm', 'run', 'build'], cwd=ROOT, env=env, check=True)
        subprocess.run(['mvn', '-q', '-Dmaven.test.skip=true', 'clean', 'compile'], cwd=ROOT / 'backend', check=True)
        static = ROOT / 'backend/target/classes/static'
        shutil.rmtree(static, ignore_errors=True)
        shutil.copytree(ROOT / 'dist', static)
        subprocess.run(['mvn', '-q', '-Dmaven.resources.skip=true', '-Dmaven.test.skip=true', 'package'], cwd=ROOT / 'backend', check=True)
        subprocess.run(['mvn', '-q', '-Dmaven.test.skip=true', 'package'], cwd=ROOT / 'agent-java', check=True)
    backend = ROOT / 'backend/target/qoj-backend-0.1.0.jar'
    agent = ROOT / 'agent-java/target/qoj-agent-0.1.0.jar'
    check_jar(backend, 'com.qoj.QojApplication', [
        'com/qoj/module/course/controller/AdminCourseController',
        'com/qoj/module/agent/service/AdminChatAgentService',
        'com/qoj/module/contest/service/ContestIpAccessService',
        'com/qoj/module/judge/gojudge/CommunicationJudge',
        'com/qoj/module/problem/service/CommunicationPackageReader',
        'com/qoj/module/contest/controller/AdminPolygonController',
        'com/qoj/module/contest/service/PolygonContestService',
        'com/qoj/module/contest/service/PolygonPackageReader'])
    check_jar(agent, 'com.qojagent.AgentApplication', [])
    if not (ROOT / 'dist/index.html').is_file():
        raise SystemExit('前端构建不存在')
    # A release must contain every current migration and exactly the frontend being shipped.
    with zipfile.ZipFile(backend) as jar:
        for migration in (ROOT / 'backend/src/main/resources/db/migration').glob('V*.sql'):
            entry = 'BOOT-INF/classes/db/migration/' + migration.name
            if entry not in jar.namelist() or jar.read(entry) != migration.read_bytes():
                raise SystemExit(f'后端 JAR 中迁移缺失或过期：{migration.name}')
        for asset in (ROOT / 'dist').rglob('*'):
            if not asset.is_file():
                continue
            entry = 'BOOT-INF/classes/static/' + asset.relative_to(ROOT / 'dist').as_posix()
            if entry not in jar.namelist() or jar.read(entry) != asset.read_bytes():
                raise SystemExit(f'后端内嵌前端与 dist 不一致：{asset.name}')
    timestamp = datetime.now(ZoneInfo('Asia/Shanghai'))
    release_id = 'qoj-native-' + timestamp.strftime('%Y%m%d-%H%M%S')
    destination = ROOT / 'release' / release_id
    destination.mkdir(parents=True)
    shutil.copytree(ROOT / 'deploy/native', destination, dirs_exist_ok=True,
        ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    shutil.copytree(ROOT / 'dist', destination / 'frontend')
    (destination / 'backend').mkdir()
    shutil.copy2(backend, destination / 'backend/qoj-backend.jar')
    shutil.copy2(agent, destination / 'optional-agent/qoj-agent.jar')
    shutil.copytree(ROOT / 'backend/src/main/resources/db/migration', destination / 'migrations')
    (destination / 'docs').mkdir()
    shutil.copy2(ROOT / 'docs/polygon-contests.md', destination / 'docs/polygon-contests.md')
    shutil.copy2(ROOT / 'docs/communication-task-design.md', destination / 'docs/communication-task-design.md')
    shutil.copytree(ROOT / 'docs/examples/communication', destination / 'docs/examples/communication')
    shutil.copy2(ROOT / 'docs/go-judge-security-deployment.md', destination / 'judge/security.md')
    security_doc = destination / 'judge/security.md'
    security_doc.write_text(security_doc.read_text().replace('../docker/go-judge/', './'))
    migrations = sorted((destination / 'migrations').glob('V*.sql'),
        key=lambda path: int(path.name.split('__')[0][1:]))
    info = {'releaseId': release_id, 'builtAt': timestamp.isoformat(), 'adminPrefix': args.admin_prefix,
        'adminApiPrefix': api_prefix, 'javaVersion': 17, 'targetOS': 'Ubuntu 22.04/24.04/26.04 LTS',
        'architectures': ['amd64', 'arm64'], 'database': 'native MySQL 8.0/8.4', 'redis': 'native Redis',
        'latestMigration': migrations[-1].name, 'migrationCount': len(migrations),
        'backendSha256': digest(backend), 'agentSha256': digest(agent),
        'buildCommands': ['npm run build', 'cd backend && mvn -q -Dmaven.test.skip=true clean compile',
            'copy dist into backend/target/classes/static',
            'cd backend && mvn -q -Dmaven.resources.skip=true -Dmaven.test.skip=true package',
            'cd agent-java && mvn -q -Dmaven.test.skip=true package'],
        'unitTestsRun': False, 'containsLocalSecrets': False, 'containsDatabaseBackup': False,
        'optionalAgentSkillIncluded': False}
    (destination / 'build-info.json').write_text(json.dumps(info, ensure_ascii=False, indent=2) + '\n')
    for script in (destination / 'scripts').iterdir():
        if script.suffix in ('.sh', '.py'):
            script.chmod(0o755)
    checksums = ''.join(f'{digest(path)}  {path.relative_to(destination)}\n'
        for path in sorted(destination.rglob('*')) if path.is_file())
    (destination / 'SHA256SUMS').write_text(checksums)
    archive_path = ROOT / 'release' / f'{release_id}.tar.gz'
    with tarfile.open(archive_path, 'w:gz') as archive:
        archive.add(destination, arcname=release_id)
    checksum_path = Path(str(archive_path) + '.sha256')
    checksum_path.write_text(f'{digest(archive_path)}  {archive_path.name}\n')
    print(json.dumps({'archive': str(archive_path), 'checksum': str(checksum_path),
        'guide': str(destination / 'README.md'), 'sizeMB': round(archive_path.stat().st_size / 1024**2, 1),
        'adminPath': '/' + args.admin_prefix}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
