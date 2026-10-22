"""SQL semantics verification: python3 tools/verify-dashboard-ac-date.py."""
import json
from pathlib import Path
import re
import sqlite3

root = Path(__file__).resolve().parents[1]
source = (root / 'backend/src/main/java/com/qoj/module/admin/service/AdminDashboardService.java').read_text()
assert 'todayAcceptedCount(todayStart, tomorrowStart)' not in source, 'Card must reuse the trend aggregation'
assert 'long todayAccepted = todayStats.accepted();' in source
mapper = (root / 'backend/src/main/java/com/qoj/module/submission/mapper/SubmissionMapper.java').read_text()
sql = re.search(r'@Select\("""\s*(SELECT DATE\(COALESCE.*?)(?:\s*"""\))', mapper, re.S).group(1)
sql = sql.replace('#{startDate}', '?')
db = sqlite3.connect(':memory:')
db.execute('CREATE TABLE submissions(user_id INTEGER, problem_id INTEGER, contest_id INTEGER, status TEXT, submit_time TEXT, created_at TEXT)')
start, end = '2026-10-07 00:00:00', '2026-10-08 00:00:00'
checks = []

def check(name, rows, expected):
    db.execute('DELETE FROM submissions')
    db.executemany('INSERT INTO submissions VALUES (?, ?, ?, ?, ?, ?)', rows)
    daily = db.execute(sql, (start,)).fetchall()
    actual = sum(row[2] for row in daily if row[0] == start[:10])
    checks.append(dict(name=name, expected=expected, actual=actual))
    assert actual == expected, checks[-1]

rows = [(1, p, 10, 'AC', start, '2026-10-06 23:00:00') for p in (1, 2, 3, 4, 4)]
rows += [(2, 4, 10, 'AC', start, '2026-10-06 23:00:00'), (2, 5, None, 'AC', start, start)]
check('six contest AC plus one practice AC: count all seven, including repeated same user/problem', rows, 7)
check('submission date takes precedence over creation date', [(1, 1, 10, 'AC', '2026-10-06 23:59:59', start)], 0)
check('legacy fallback', [(1, 1, None, 'AC', None, start)], 1)
check('exclude WA and WAITING', [(1, 1, 10, s, start, start) for s in ('WA', 'WAITING')], 0)
check('date boundaries', [(1, 1, 10, 'AC', start, start), (1, 1, 10, 'AC', end, start)], 1)
check('historical accepted status', [(1, 1, 10, 'ACCEPTED', start, start)], 1)
check('empty', [], 0)
check('provided response fixture: eight submissions and five AC',
      [(1, p, 18, 'AC' if p <= 5 else 'WA', start, start) for p in range(1, 9)], 5)
out = root / 'output/dashboard-ac-date/report.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(dict(passed=True, sql=sql, checks=checks,
    reproduce='python3 tools/verify-dashboard-ac-date.py',
    limitation='Local SQL semantics verification with fixtures; live MySQL/API data not verified'), indent=2))
print(f'PASS {len(checks)} scenarios: {out}')
