"""Real class-import/password/login regression in the disposable HTTP harness."""
import json
import urllib.request
import uuid


def verify_import_password(output, base, prefix, http, sql, redis, check, admin, teacher, tid, hashed, password):
    class_id = 93841
    sql(f"INSERT INTO classes(id,name,teacher_id) VALUES({class_id},'Import password E2E',{tid});")

    def upload(actor, path, number):
        boundary = 'qoj' + uuid.uuid4().hex
        parts = []
        for key, value in [('classId', str(class_id)), ('studentNoField', '学号'), ('nameField', '姓名')]:
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n')
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="students.csv"\r\nContent-Type: text/csv\r\n\r\n学号,姓名\n{number},Password E2E\n\r\n--{boundary}--\r\n')
        request = urllib.request.Request(base + path, data=''.join(parts).encode(), headers={
            'Authorization': 'Bearer ' + actor, 'Content-Type': 'multipart/form-data; boundary=' + boundary})
        result = json.load(urllib.request.urlopen(request, timeout=60))
        assert result['code'] == 200, result
        assert result['data']['successCount'] == 1, result
        return result['data']['successes'][0]

    def login(number, secret):
        captcha = http('/api/v1/captcha/image')
        result = http('/api/v1/auth/login', {'username': number, 'password': secret,
            'captchaId': captcha['captchaId'], 'captcha': redis('GET', 'oj:captcha:' + captcha['captchaId'])})
        assert result['accessToken']

    cases = [(admin, prefix + '/students/import', '009381234567'),
             (teacher, '/api/teacher/v1/students/import-file', '009382234567'),
             (admin, prefix + '/students/import', '12345')]
    results = []
    for actor, path, number in cases:
        receipt = upload(actor, path, number)
        expected = number[-6:]
        assert receipt['initialPassword'] == expected, receipt
        stored = sql(f"SELECT password_hash FROM users WHERE student_no='{number}';")
        assert stored.startswith('$2') and stored != expected
        login(number, expected)
        sql(f"UPDATE users SET password_hash='{hashed}' WHERE student_no='{number}';")
        repeat = upload(actor, path, number)
        assert repeat.get('initialPassword') is None, repeat
        assert sql(f"SELECT password_hash FROM users WHERE student_no='{number}';") == hashed
        login(number, password)
        results.append({'portal': 'admin' if actor == admin else 'teacher',
                        'shortStudentNumber': len(number) < 6, 'initialLogin': True,
                        'existingPasswordPreserved': True, 'bcryptStored': True})
    (output / 'import-password-report.json').write_text(json.dumps({'passed': True, 'checks': results}, indent=2))
    check('admin/teacher class file imports use student number suffix and real frontend login, BCrypt and repeat-import password preservation pass')
