from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import textwrap


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "project-architecture.png"

W, H = 2400, 1650
BG = "#f6f8fb"
INK = "#172033"
MUTED = "#5b667a"
BLUE = "#2563eb"
GREEN = "#059669"
ORANGE = "#d97706"
PURPLE = "#7c3aed"
RED = "#dc2626"
BORDER = "#d7deea"

FONT_PATHS = [
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/Helvetica.ttc",
]


def font(size, bold=False):
    for path in FONT_PATHS:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size=size, index=0)
            except Exception:
                continue
    return ImageFont.load_default()


TITLE = font(58)
SUB = font(26)
H1 = font(34)
H2 = font(27)
BODY = font(23)
SMALL = font(19)


def rounded(draw, xy, fill, outline=BORDER, radius=28, width=2):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def text(draw, xy, value, fnt=BODY, fill=INK, anchor=None):
    draw.text(xy, value, font=fnt, fill=fill, anchor=anchor)


def wrapped(draw, xy, value, max_chars, fnt=BODY, fill=MUTED, line_gap=8):
    x, y = xy
    lines = []
    for paragraph in value.split("\n"):
        lines.extend(textwrap.wrap(paragraph, width=max_chars) or [""])
    for line in lines:
        draw.text((x, y), line, font=fnt, fill=fill)
        y += fnt.size + line_gap
    return y


def box(draw, xy, title, body, color, max_chars=22):
    x1, y1, x2, y2 = xy
    rounded(draw, xy, "#ffffff")
    draw.rounded_rectangle((x1, y1, x2, y1 + 68), radius=28, fill=color)
    draw.rectangle((x1, y1 + 36, x2, y1 + 68), fill=color)
    text(draw, (x1 + 28, y1 + 19), title, H2, "#ffffff")
    wrapped(draw, (x1 + 28, y1 + 92), body, max_chars, BODY, MUTED)


def chip(draw, xy, label, color):
    x, y = xy
    pad_x, pad_y = 18, 9
    bbox = draw.textbbox((0, 0), label, font=SMALL)
    w = bbox[2] - bbox[0] + pad_x * 2
    h = bbox[3] - bbox[1] + pad_y * 2
    draw.rounded_rectangle((x, y, x + w, y + h), radius=18, fill=color)
    text(draw, (x + pad_x, y + pad_y - 1), label, SMALL, "#ffffff")
    return x + w + 12


def arrow(draw, start, end, color="#607089", width=5):
    draw.line((start, end), fill=color, width=width)
    sx, sy = start
    ex, ey = end
    if abs(ex - sx) >= abs(ey - sy):
        sign = 1 if ex >= sx else -1
        head = [(ex, ey), (ex - sign * 20, ey - 12), (ex - sign * 20, ey + 12)]
    else:
        sign = 1 if ey >= sy else -1
        head = [(ex, ey), (ex - 12, ey - sign * 20), (ex + 12, ey - sign * 20)]
    draw.polygon(head, fill=color)


img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)

text(draw, (90, 62), "QOJ 项目架构图", TITLE)
text(draw, (92, 135), "React/Vite 前端 + Spring Boot 后端 + MySQL/Redis + 判题与邮件等外部服务", SUB, MUTED)

x = 90
for label, color in [
    ("前台用户中心", BLUE),
    ("教师端", GREEN),
    ("后台管理", PURPLE),
    ("REST API / WebSocket", ORANGE),
    ("MySQL + Redis", RED),
]:
    x = chip(draw, (x, 190), label, color)

box(
    draw,
    (90, 280, 610, 610),
    "浏览器访问层",
    "学生、教师、管理员通过同一前端入口访问。\nNginx 托管 dist 静态资源，并将 /api 与 /ws 转发到后端。",
    BLUE,
)
box(
    draw,
    (720, 280, 1320, 610),
    "前端应用 src/",
    "React 19 + TypeScript + Vite。\n前台页面：src/pages\n教师端：src/teacher\n后台管理：src/admin\n公共组件：src/components\n接口封装：src/api、src/data",
    GREEN,
    25,
)
box(
    draw,
    (1430, 280, 2310, 610),
    "后端服务 backend/",
    "Spring Boot + Spring Security + MyBatis-Plus。\n统一返回 ApiResponse，JWT 鉴权，WebSocket 推送判题/榜单消息，Flyway 管理数据库迁移。",
    PURPLE,
    34,
)

box(
    draw,
    (90, 740, 610, 1095),
    "前端核心功能",
    "首页、题库、题单、比赛、排行榜、提交队列、用户中心。\n教师端支持题目/题单/比赛/学生导入与统计。\n后台支持用户、题目、比赛、提交、系统配置。",
    BLUE,
)
box(
    draw,
    (720, 740, 1320, 1095),
    "后端业务模块",
    "auth/user/classroom/problem/practice/contest/submission/judge/leaderboard/home/setting/announcement/teacher/xcpcio/agent。\n每个模块按 controller、service、mapper、entity、dto、vo 分层。",
    GREEN,
    26,
)
box(
    draw,
    (1430, 740, 1850, 1095),
    "数据层 MySQL",
    "核心表约 38 张。\n包含用户、管理员、班级、题目、题单、比赛、报名、提交、测试点、排行榜缓存、系统配置等数据。",
    ORANGE,
    18,
)
box(
    draw,
    (1890, 740, 2310, 1095),
    "缓存层 Redis",
    "保存排行榜缓存、班级 AC 统计、提交队列/状态缓存、临时验证码与运行时数据。",
    RED,
    18,
)

box(
    draw,
    (90, 1230, 610, 1515),
    "部署产物",
    "前端：dist/ 静态文件\n后端：qoj-backend-*.jar\n数据库：qoj-full-backup.sql\n配置：.env / Nginx / Docker",
    BLUE,
)
box(
    draw,
    (720, 1230, 1320, 1515),
    "判题链路",
    "提交代码 -> SubmissionService 入队 -> Judge 服务处理 -> 写入 submissions 与 case results -> WebSocket 推送状态。",
    GREEN,
    25,
)
box(
    draw,
    (1430, 1230, 1850, 1515),
    "外部服务",
    "SMTP 邮件验证码\nDOMjudge 或 Docker Judge\nXCPCIO/CLICS 赛事同步\nDeepSeek/Agent 可选接入",
    PURPLE,
    18,
)
box(
    draw,
    (1890, 1230, 2310, 1515),
    "安全与权限",
    "JWT 登录态、后台 AdminApi 拦截、访问策略 Policy、BCrypt(12) 密码哈希、导入文件校验与 XSS 过滤。",
    RED,
    18,
)

arrow(draw, (610, 445), (720, 445))
arrow(draw, (1320, 445), (1430, 445))
arrow(draw, (1015, 610), (1015, 740))
arrow(draw, (1615, 610), (1615, 740))
arrow(draw, (1850, 917), (1890, 917))
arrow(draw, (1640, 1095), (1640, 1230))
arrow(draw, (1320, 1400), (1430, 1400))
arrow(draw, (610, 1390), (720, 1390))

text(draw, (90, 1590), "生成位置：docs/project-architecture.png    说明：该图按当前仓库目录和模块划分绘制，适合部署说明、汇报和服务器交付文档。", SMALL, MUTED)

OUT.parent.mkdir(parents=True, exist_ok=True)
img.save(OUT)
print(OUT)
