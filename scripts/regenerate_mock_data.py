# -*- coding: utf-8 -*-
"""重新生成学情看板 data/ 目录全部模拟 CSV（UTF-8 BOM）。"""
from __future__ import annotations

import csv
import random
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RNG = random.Random(20250901)

DATE_START = date(2025, 9, 1)
DATE_END = date(2025, 9, 30)
DATE_STRS = [
    (DATE_START + timedelta(days=i)).isoformat()
    for i in range((DATE_END - DATE_START).days + 1)
]

# 刷卷布置时间窗（同一套卷学生完成时间落在窗内相邻1-2天）
EXAM_WINDOWS: list[tuple[str, str]] = [
    ("2025-09-03", "2025-09-05"),
    ("2025-09-08", "2025-09-10"),
    ("2025-09-13", "2025-09-15"),
    ("2025-09-18", "2025-09-20"),
    ("2025-09-23", "2025-09-25"),
    ("2025-09-27", "2025-09-29"),
]

ACCOUNTS_CSV = """用户身份,用户分层,用户名,登录密码,学校名称,所属校区,年级,管理班级,授课班级,学科
校长,管理层,lili,123456,广州大学附属中学,黄华路校区,,,,
年级组长,管理层,景沐言,123456,广州大学附属中学,黄华路校区,初一,4班,"4班,5班,6班",语文
学科组长,管理层,苏晚灯,123456,广州大学附属中学,黄华路校区,初二,5班,"4班,5班,6班",物理
老师,一线层,xiaoqi,123456,广州大学附属中学,黄华路校区,初一,1班,"1班,2班,3班",数学
老师,一线层,zeming,123456,广州大学附属中学,黄华路校区,初一,,"1班,2班,3班",英语
校长,管理层,panyu,123456,广附番禺实验学校,,,,,
"""

TEXTBOOK = {
    "语文": "部编版",
    "数学": "人教版",
    "英语": "牛津版",
    "物理": "人教版",
    "化学": "人教版",
    "生物": "人教版",
    "历史": "部编版",
    "地理": "人教版",
    "思想政治": "人教版",
    "道德与法治": "部编版",
    "科学": "教科版",
}

SUBJECT_KP: dict[str, list[tuple[str, str]]] = {
    "语文": [
        ("第二单元", "文言文翻译"),
        ("第二单元", "诗词鉴赏手法"),
        ("第一单元", "记叙文阅读理解"),
        ("第一单元", "字词释义"),
    ],
    "数学": [
        ("第三章", "一元一次方程的解法"),
        ("第二章", "合并同类项"),
        ("第一章", "有理数的运算"),
        ("第一章", "绝对值"),
    ],
    "英语": [
        ("Unit3", "一般现在时"),
        ("Unit2", "there be句型"),
        ("Unit4", "阅读理解技巧"),
        ("Unit3", "词汇辨析"),
    ],
    "物理": [
        ("第一章", "速度的计算"),
        ("第二章", "力的合成"),
        ("第一章", "声音的传播"),
    ],
    "化学": [
        ("第一章", "化学方程式配平"),
        ("第二章", "酸碱盐性质"),
    ],
    "生物": [
        ("第二章", "细胞的结构与功能"),
        ("第二单元", "光合作用"),
    ],
    "历史": [
        ("第三单元", "秦朝统一六国"),
        ("第二单元", "丝绸之路"),
        ("第二单元", "辛亥革命"),
    ],
    "道德与法治": [
        ("第一单元", "公民的基本权利与义务"),
        ("第二单元", "法律的作用"),
    ],
    "科学": [
        ("第一章", "物质的变化"),
        ("第二章", "力与运动"),
    ],
    "地理": [
        ("第二章", "中国地形特征"),
        ("第三章", "气候类型"),
    ],
    "思想政治": [
        ("第一单元", "唯物辩证法"),
        ("第二单元", "经济生活"),
    ],
}

MATERIAL_NAMES: dict[str, list[str]] = {
    "数学": ["第三章 一元一次方程 知识清单", "有理数运算 考点梳理", "第二章 整式 知识清单"],
    "语文": ["第二单元 古诗词鉴赏 知识清单", "文言文翻译技巧讲义", "记叙文阅读方法归纳"],
    "英语": ["Unit3 重点语法归纳", "初一英语词汇手册", "阅读理解技巧讲义"],
    "物理": ["第一章 声现象 知识清单", "欧姆定律 考点梳理"],
    "化学": ["化学方程式 知识清单", "酸碱盐 考点梳理"],
    "历史": ["第三单元 秦汉时期 考点梳理", "近代史 材料题技巧"],
    "道德与法治": ["第一单元 成长的节拍 知识清单", "公民权利义务 知识清单"],
    "生物": ["第二章 细胞 知识清单", "生态系统 知识清单"],
    "科学": ["第一章 物质的变化 知识清单", "力与运动 实验指导"],
    "地理": ["中国地形 知识清单", "气候类型 归纳"],
    "思想政治": ["经济生活 知识清单", "唯物辩证法 讲义"],
}

VIDEO_NAMES: dict[str, list[str]] = {
    "数学": ["一元一次方程的解法（同步精讲）", "有理数运算（同步课）", "初一数学期中考点串讲"],
    "语文": ["古诗词鉴赏方法（同步课）", "文言文虚词用法精讲", "记叙文阅读（同步精讲）"],
    "英语": ["Unit3 语法精讲（同步课）", "阅读理解技巧（同步课）"],
    "物理": ["力的合成与分解专题", "欧姆定律应用（同步精讲）"],
    "化学": ["化学方程式配平（同步课）", "初三化学中考一轮复习"],
    "历史": ["秦汉时期 考点串讲"],
    "生物": ["细胞结构（同步精讲）"],
    "科学": ["物质的变化（同步课）"],
    "道德与法治": ["公民权利义务（同步课）"],
    "地理": ["气候类型判读（同步课）"],
    "思想政治": ["经济生活（同步精讲）"],
}

VIDEO_CONTENT_TYPES = ["视频课", "典例精讲", "同步精讲", "知识点精讲"]

STUDENT_LIST_SCHOOL = "广州大学附属中学"

PRACTICE_SCENE_CFG = [
    (2, "资料在线练"),  # QBM资料在线练
    (3, "同步学在线练"),
    (102, "同步学薄弱再练"),
    (4, "阶段复习在线练"),  # 阶段复习题组在线练
    (5, "升学备考薄弱再练"),  # 升学备考-诊薄弱题组在线练
    (105, "升学备考精准练"),  # 升学备考-精准练题组在线练
]

SCENE_ALIASES: dict[str, str] = {
    "QBM资料在线练": "资料在线练",
    "同步学": "同步学在线练",
    "阶段复习": "阶段复习在线练",
    "阶段复习题组在线练": "阶段复习在线练",
    "升学备考-诊薄弱": "升学备考薄弱再练",
    "升学备考-诊薄弱题组在线练": "升学备考薄弱再练",
    "升学备考-精准练": "升学备考精准练",
    "升学备考-精准练题组在线练": "升学备考精准练",
}


def normalize_scene(scene: str) -> str:
    s = (scene or "").strip()
    return SCENE_ALIASES.get(s, s)


def subjects_for_grade(grade: str) -> list[str]:
    g = (grade or "").strip()
    if g in ("一年级", "二年级"):
        return ["语文", "数学", "英语"]
    if g in ("三年级", "四年级", "五年级", "六年级"):
        return ["语文", "数学", "英语", "科学"]
    if g in ("初一", "七年级"):
        return ["语文", "数学", "英语", "历史", "道德与法治", "生物", "科学"]
    if g in ("初二", "八年级"):
        return ["语文", "数学", "英语", "物理", "历史", "道德与法治", "生物"]
    if g in ("初三", "九年级"):
        return ["语文", "数学", "英语", "物理", "化学", "历史", "道德与法治"]
    if g in ("高一", "高二", "高三"):
        return [
            "语文",
            "数学",
            "英语",
            "物理",
            "化学",
            "生物",
            "历史",
            "地理",
            "思想政治",
        ]
    return ["语文", "数学", "英语"]


def is_senior_grade(grade: str) -> bool:
    return grade in ("初三", "九年级", "高三")


def write_csv(path: Path, fieldnames: list[str], rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def read_students() -> list[dict]:
    rows: list[dict] = []
    with (DATA / "students.csv").open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            school = (row.get("学校") or "").strip()
            if school == "广大附中":
                school = "广州大学附属中学"
            rows.append(
                {
                    "student_id": row["学生编号"].strip(),
                    "student_name": row["姓名"].strip(),
                    "school_name": school,
                    "campus": row["校区"].strip(),
                    "grade": row["年级"].strip(),
                    "class_name": row["班级"].strip(),
                }
            )
    return rows


def pick_inactive(students: list[dict]) -> set[str]:
    n = max(1, round(len(students) * 0.1))
    ids = sorted(s["student_id"] for s in students)
    r = random.Random(20250901)
    r.shuffle(ids)
    return set(ids[:n])


def dates_in_range(start: str, end: str) -> list[str]:
    s = date.fromisoformat(start)
    e = date.fromisoformat(end)
    out = []
    cur = s
    while cur <= e:
        out.append(cur.isoformat())
        cur += timedelta(days=1)
    return out


def rand_clock() -> str:
    return f"{RNG.randint(7, 22):02d}:{RNG.randint(0, 59):02d}:{RNG.randint(0, 59):02d}"


def to_datetime(day: str, student_id: str, salt: str = "") -> str:
    """生成 2025-09-05 09:30:00 格式时间。"""
    r = random.Random(f"{student_id}:{day}:{salt}")
    h, m, s = r.randint(7, 21), r.randint(0, 59), r.randint(0, 59)
    return f"{day} {h:02d}:{m:02d}:{s:02d}"


def submit_in_window(
    window: tuple[str, str], student_id: str, paper_id: str
) -> str:
    """同一试卷不同学生在窗口内相邻0-2天完成。"""
    days = dates_in_range(window[0], window[1])
    r = random.Random(f"{student_id}:{paper_id}")
    base = r.choice(days)
    offset = r.randint(0, min(2, max(0, (date.fromisoformat(window[1]) - date.fromisoformat(window[0])).days)))
    final = (date.fromisoformat(base) + timedelta(days=offset)).isoformat()
    if final > window[1]:
        final = window[1]
    return to_datetime(final, student_id, paper_id)


def spread_sep_day(student_id: str, salt: str, pool: list[str] | None = None) -> str:
    days = pool or DATE_STRS
    r = random.Random(f"{student_id}:day:{salt}")
    return r.choice(days)


def student_weights(sid: str, subjects: list[str]) -> dict[str, float]:
    r = random.Random(sid)
    w = {s: r.uniform(0.35, 1.0) for s in subjects}
    fav = r.choice(subjects)
    w[fav] = r.uniform(1.5, 2.4)
    weak = r.choice([s for s in subjects if s != fav])
    w[weak] = r.uniform(0.2, 0.5)
    return w


def subject_rate(sid: str, subject: str) -> float:
    return round(random.Random(f"{sid}:{subject}").uniform(0.52, 0.93), 2)


ZUJUAN_QUESTION_ID_BASE = 33474302

# 组卷网学科库 ID（bank_id），用于 https://zujuan.xkw.com/{bank_id}q{id}.html
SUBJECT_BANK_ID: dict[str, str] = {
    "语文": "11",
    "数学": "11",
    "英语": "11",
    "物理": "11",
    "化学": "11",
    "生物": "11",
    "生物学": "11",
    "历史": "11",
    "地理": "11",
    "道德与法治": "11",
    "思想政治": "11",
    "政治（道法）": "11",
    "科学": "11",
}


def zujuan_question_id(paper_id: str, question_no: int) -> str:
    seed = 0
    for ch in str(paper_id):
        seed = (seed * 31 + ord(ch)) & 0xFFFFFFFF
    paper_offset = (seed % 500) * 20
    return f"11q{ZUJUAN_QUESTION_ID_BASE + paper_offset + question_no - 1}"


def numeric_question_id(paper_id: str, question_no: int) -> str:
    """与生产 exam_detail 样例一致的 16 位组卷网试题 ID"""
    r = random.Random(f"{paper_id}:qno:{question_no}")
    return str(r.randint(3500000000000000, 4099999999999999))


EXAM_SAMPLE_PATH = DATA / "exam_detail样例.csv"
PRACTICE_SAMPLE_PATH = DATA / "practice_detail样例.csv"
KNOWLEDGE_SAMPLE_PATH = DATA / "knowledge_mastery样例.csv"
PAPER_QUESTIONS_PATH = DATA / "paper_questions.csv"
_EXAM_SAMPLE_CACHE: list[dict] | None = None
_EXAM_QUESTION_ID_POOL: list[str] | None = None
_PRACTICE_SAMPLE_CACHE: list[dict] | None = None
_KNOWLEDGE_SAMPLE_CACHE: list[dict] | None = None
_KNOWLEDGE_PAPER_TEMPLATES: dict[str, list[dict]] | None = None
_PAPER_CATALOG: dict[str, dict] | None = None
_PAPER_SUBJECT_HINTS: dict[str, str] | None = None


def is_garbled_text(val: str) -> bool:
    if not val:
        return True
    return "\ufffd" in val or "�" in val


def format_exam_submit_time(dt_str: str, student_id: str, salt: str = "") -> str:
    """样例格式：2026/4/29 10:40"""
    text = (dt_str or "").strip()
    if len(text) >= 8 and text[4] == "/" and " " in text:
        return text
    normalized = text.replace("/", "-")
    try:
        if len(normalized) >= 19:
            d = datetime.strptime(normalized[:19], "%Y-%m-%d %H:%M:%S")
        elif len(normalized) >= 16:
            d = datetime.strptime(normalized[:16], "%Y-%m-%d %H:%M")
        else:
            d = datetime.fromisoformat(normalized[:10])
            r = random.Random(f"{student_id}:{salt}:t")
            d = d.replace(hour=r.randint(7, 21), minute=r.randint(0, 59))
    except ValueError:
        d = datetime.fromisoformat(DATE_STRS[0] + " 10:00:00")
    return f"{d.year}/{d.month}/{d.day} {d.hour}:{d.minute:02d}"


def infer_is_submit(raw: str, wrong_count: int, correct_rate: float) -> str:
    raw = (raw or "").strip()
    if "未交卷" in raw:
        return "未交卷仅在线练"
    if "已交卷" in raw:
        return "已交卷"
    if wrong_count > 0 or correct_rate not in (0, 0.0):
        return "已交卷"
    return "未交卷仅在线练"


def row_exam_submit_status(raw_row: dict) -> str:
    for key in ("is_submit", "is_submitted", "是否提交"):
        val = raw_row.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    return ""


def iter_csv_dict_rows(path: Path):
    """样例 CSV 可能是 UTF-8 或 GBK（Excel 另存为）。"""
    if not path.is_file():
        return
    last_err: UnicodeDecodeError | None = None
    for enc in ("utf-8-sig", "utf-8", "gb18030"):
        try:
            with path.open(encoding=enc, newline="") as f:
                for row in csv.DictReader(f):
                    yield row
                return
        except UnicodeDecodeError as exc:
            last_err = exc
    if last_err:
        raise last_err


def load_exam_sample_rows() -> list[dict]:
    if not EXAM_SAMPLE_PATH.is_file():
        return []
    rows: list[dict] = []
    for row in iter_csv_dict_rows(EXAM_SAMPLE_PATH):
        wc = int(row.get("wrong_count") or 0)
        cr = float(row.get("correct_rate") or 0)
        subject = (row.get("subject") or "").strip()
        paper_name = (row.get("paper_name") or "").strip()
        grade_level = (row.get("grade_level") or "高三").strip()
        scene = (row.get("scene") or "刷真题").strip()
        if is_garbled_text(subject):
            subject = ""
        if is_garbled_text(paper_name):
            paper_name = ""
        if is_garbled_text(grade_level):
            grade_level = "高三"
        if is_garbled_text(scene):
            scene = "刷真题"
        rows.append(
            {
                "paper_id": str(row.get("paper_id") or "").strip(),
                "paper_name": paper_name,
                "subject": subject,
                "grade_level": grade_level,
                "scene": scene,
                "total_questions": int(row.get("total_questions") or 0),
                "wrong_count": wc,
                "correct_rate": cr,
                "is_submit": infer_is_submit(row_exam_submit_status(row), wc, cr),
            }
        )
    return [r for r in rows if r["paper_id"] and r["total_questions"] > 0]


def load_exam_question_id_pool() -> list[str]:
    pool: set[str] = set()
    if not EXAM_SAMPLE_PATH.is_file():
        return []
    for row in iter_csv_dict_rows(EXAM_SAMPLE_PATH):
        raw = (row.get("wrong_question_ids") or "").strip()
        if not raw or raw.lower() == "null":
            continue
        compact = raw.replace(",", "")
        if compact.isdigit() and 10 <= len(compact) <= 19:
            pool.add(compact)
        for part in raw.split(","):
            p = part.strip()
            if p.isdigit() and 10 <= len(p) <= 19:
                pool.add(p)
    return sorted(pool)


def infer_practice_submit(raw: str, wrong_count: int, correct_rate: float) -> str:
    raw = (raw or "").strip()
    if "未交卷" in raw:
        return "未交卷"
    if "已交卷" in raw:
        return "已交卷"
    if wrong_count > 0 or correct_rate not in (0, 0.0):
        return "已交卷"
    return "未交卷"


def load_practice_sample_rows() -> list[dict]:
    if not PRACTICE_SAMPLE_PATH.is_file():
        return []
    rows: list[dict] = []
    for row in iter_csv_dict_rows(PRACTICE_SAMPLE_PATH):
        wc = int(row.get("wrong_count") or 0)
        cr = float(row.get("correct_rate") or 0)
        subject = (row.get("subject") or "").strip()
        paper_name = (row.get("paper_name") or "").strip()
        scene = normalize_scene((row.get("scene") or "同步学在线练").strip())
        if is_garbled_text(subject) or subject.lower() == "null":
            subject = ""
        if is_garbled_text(paper_name):
            paper_name = ""
        if is_garbled_text(scene):
            scene = "同步学在线练"
        rows.append(
            {
                "paper_id": str(row.get("paper_id") or "").strip(),
                "paper_name": paper_name,
                "subject": subject,
                "scene": scene,
                "total_questions": int(row.get("total_questions") or 0),
                "wrong_count": wc,
                "correct_rate": cr,
                "is_submit": infer_practice_submit(
                    row_exam_submit_status(row), wc, cr
                ),
            }
        )
    return [r for r in rows if r["paper_id"] and r["total_questions"] > 0]


def get_practice_sample_rows() -> list[dict]:
    global _PRACTICE_SAMPLE_CACHE
    if _PRACTICE_SAMPLE_CACHE is None:
        _PRACTICE_SAMPLE_CACHE = load_practice_sample_rows()
    return _PRACTICE_SAMPLE_CACHE


def pick_practice_template(
    subject: str | None = None, scene_hint: str | None = None
) -> dict:
    catalog = get_paper_catalog()
    rows = get_practice_sample_rows()
    if catalog:
        in_catalog = [r for r in rows if str(r.get("paper_id") or "") in catalog]
        pool = in_catalog
        if subject and pool:
            matched = [r for r in pool if subjects_match(r.get("subject", ""), subject)]
            if matched:
                pool = matched
        if scene_hint and pool:
            hint = normalize_scene(scene_hint)
            hinted = [
                r
                for r in pool
                if normalize_scene(r.get("scene") or "") == hint
                or hint in normalize_scene(r.get("scene") or "")
                or normalize_scene(r.get("scene") or "") in hint
            ]
            if hinted:
                pool = hinted
        if pool:
            tpl = RNG.choice(pool)
            return enrich_template_from_catalog(
                tpl, tpl["paper_id"], subject, online_practice=True
            )
        pid = pick_catalog_paper_id(subject, online_practice=True)
        if pid:
            sample = next(
                (r for r in rows if str(r.get("paper_id")) == pid),
                None,
            )
            entry = get_paper_catalog_entry(pid)
            return {
                "paper_id": pid,
                "paper_name": (sample or {}).get("paper_name") or "",
                "subject": subject or (sample or {}).get("subject") or "数学",
                "scene": normalize_scene(
                    scene_hint or (sample or {}).get("scene") or "同步学在线练"
                ),
                "total_questions": entry["total"] if entry else 5,
            }
    if not rows:
        pid = pick_catalog_paper_id(subject, online_practice=True) or (
            f"4QJR{RNG.choice('ABCDEFGHJKLMNPQRSTUVWXYZ')}{RNG.randint(1000, 9999)}"
        )
        scene = normalize_scene(scene_hint or "同步学在线练")
        total = catalog_paper_total(pid, RNG.choice([4, 5, 6, 10]))
        return {
            "paper_id": pid,
            "paper_name": "",
            "subject": subject or "数学",
            "scene": scene,
            "total_questions": total,
        }
    pool = rows
    if subject:
        matched = [r for r in rows if subjects_match(r.get("subject", ""), subject)]
        if matched:
            pool = matched
    if scene_hint:
        hinted = [
            r
            for r in pool
            if scene_hint in (r.get("scene") or "")
            or (r.get("scene") or "") in scene_hint
        ]
        if hinted:
            pool = hinted
    tpl = RNG.choice(pool)
    return enrich_template_from_catalog(tpl, tpl["paper_id"], subject, online_practice=True)


def normalize_knowledge_subject(sample_subject: str, fallback: str) -> str:
    sub = (sample_subject or "").strip()
    if not sub or sub.lower() == "null" or is_garbled_text(sub):
        return fallback
    if sub == "生物学":
        return "生物"
    if sub in ("政治（道法）", "政治"):
        return fallback if fallback in ("道德与法治", "思想政治") else "道德与法治"
    return sub


def load_knowledge_sample_rows() -> list[dict]:
    if not KNOWLEDGE_SAMPLE_PATH.is_file():
        return []
    rows: list[dict] = []
    for row in iter_csv_dict_rows(KNOWLEDGE_SAMPLE_PATH):
        pid = str(row.get("paper_id") or "").strip()
        kp = (row.get("knowledge_point") or "").strip()
        subject = (row.get("subject") or "").strip()
        mastered = (row.get("is_mastered") or "").strip()
        if not pid or not kp or is_garbled_text(kp):
            continue
        if is_garbled_text(subject):
            subject = ""
        if "未掌握" in mastered:
            mastered = "未掌握"
        else:
            mastered = "已掌握"
        rows.append(
            {
                "paper_id": pid,
                "subject": subject,
                "knowledge_point": kp,
                "is_mastered": mastered,
            }
        )
    return rows


def get_knowledge_sample_rows() -> list[dict]:
    global _KNOWLEDGE_SAMPLE_CACHE
    if _KNOWLEDGE_SAMPLE_CACHE is None:
        _KNOWLEDGE_SAMPLE_CACHE = load_knowledge_sample_rows()
    return _KNOWLEDGE_SAMPLE_CACHE


def build_knowledge_paper_templates() -> dict[str, list[dict]]:
    grouped: dict[str, dict[str, dict]] = {}
    for row in get_knowledge_sample_rows():
        pid = row["paper_id"]
        kp = row["knowledge_point"]
        grouped.setdefault(pid, {})
        if kp not in grouped[pid]:
            grouped[pid][kp] = {
                "subject": row["subject"],
                "knowledge_point": kp,
            }
    return {pid: list(items.values()) for pid, items in grouped.items()}


def get_knowledge_paper_templates() -> dict[str, list[dict]]:
    global _KNOWLEDGE_PAPER_TEMPLATES
    if _KNOWLEDGE_PAPER_TEMPLATES is None:
        _KNOWLEDGE_PAPER_TEMPLATES = build_knowledge_paper_templates()
    return _KNOWLEDGE_PAPER_TEMPLATES


def get_knowledge_points_for_paper(paper_id: str) -> list[dict]:
    return get_knowledge_paper_templates().get(str(paper_id), [])


def pick_sample_knowledge_point(subject: str) -> str | None:
    rows = get_knowledge_sample_rows()
    if not rows:
        return None
    matched = [r for r in rows if subjects_match(r.get("subject", ""), subject)]
    pool = matched or rows
    return RNG.choice(pool)["knowledge_point"]


def format_judge_time(dt_str: str, student_id: str, salt: str = "") -> str:
    text = (dt_str or "").strip()
    if len(text) >= 19 and text[4] in "-/":
        normalized = text.replace("/", "-")
        try:
            datetime.strptime(normalized[:19], "%Y-%m-%d %H:%M:%S")
            return normalized[:19]
        except ValueError:
            pass
    day = date_only(dt_str) or DATE_STRS[0]
    return to_datetime(day, student_id, salt)


def get_exam_sample_rows() -> list[dict]:
    global _EXAM_SAMPLE_CACHE
    if _EXAM_SAMPLE_CACHE is None:
        _EXAM_SAMPLE_CACHE = load_exam_sample_rows()
    return _EXAM_SAMPLE_CACHE


def get_exam_question_id_pool() -> list[str]:
    global _EXAM_QUESTION_ID_POOL
    if _EXAM_QUESTION_ID_POOL is None:
        _EXAM_QUESTION_ID_POOL = load_exam_question_id_pool()
    return _EXAM_QUESTION_ID_POOL


def subjects_match(sample_subject: str, target_subject: str) -> bool:
    if not sample_subject or not target_subject:
        return False
    if sample_subject == target_subject:
        return True
    pairs = {
        "生物": {"生物学"},
        "生物学": {"生物"},
        "道德与法治": {"政治（道法）", "思想政治", "政治"},
        "政治（道法）": {"道德与法治", "思想政治", "政治"},
        "思想政治": {"政治（道法）", "道德与法治", "政治"},
    }
    return target_subject in pairs.get(sample_subject, set()) or sample_subject in pairs.get(
        target_subject, set()
    )


def is_online_practice_paper_id(paper_id: str) -> bool:
    pid = str(paper_id or "").strip()
    if pid.startswith("4QJR") or pid.startswith("HChMk"):
        return True
    return bool(pid) and not pid.isdigit()


def load_paper_questions_catalog() -> dict[str, dict]:
    global _PAPER_CATALOG
    if _PAPER_CATALOG is not None:
        return _PAPER_CATALOG
    catalog: dict[str, dict] = {}
    if not PAPER_QUESTIONS_PATH.is_file():
        _PAPER_CATALOG = catalog
        return catalog
    for row in iter_csv_dict_rows(PAPER_QUESTIONS_PATH):
        pid = str(row.get("paper_id") or "").strip()
        try:
            qno = int(row.get("question_no") or 0)
        except ValueError:
            continue
        qid = str(row.get("id") or "").strip()
        if not pid or qno < 1 or not qid:
            continue
        entry = catalog.setdefault(
            pid,
            {
                "paper_id": pid,
                "total": 0,
                "id_by_no": {},
            },
        )
        entry["id_by_no"][qno] = qid
        entry["total"] = max(entry["total"], qno)
    _PAPER_CATALOG = catalog
    return catalog


def get_paper_catalog() -> dict[str, dict]:
    return load_paper_questions_catalog()


def get_paper_catalog_entry(paper_id: str) -> dict | None:
    return get_paper_catalog().get(str(paper_id or "").strip())


def catalog_paper_total(paper_id: str, fallback: int = 0) -> int:
    entry = get_paper_catalog_entry(paper_id)
    if entry and entry.get("total"):
        return int(entry["total"])
    return fallback


def get_paper_subject_hints() -> dict[str, str]:
    global _PAPER_SUBJECT_HINTS
    if _PAPER_SUBJECT_HINTS is not None:
        return _PAPER_SUBJECT_HINTS
    hints: dict[str, str] = {}
    for row in get_exam_sample_rows():
        pid = str(row.get("paper_id") or "").strip()
        if pid and row.get("subject"):
            hints[pid] = row["subject"]
    for row in get_practice_sample_rows():
        pid = str(row.get("paper_id") or "").strip()
        if pid and row.get("subject"):
            hints[pid] = row["subject"]
    _PAPER_SUBJECT_HINTS = hints
    return hints


def pick_catalog_paper_id(subject: str | None, online_practice: bool) -> str | None:
    catalog = get_paper_catalog()
    if not catalog:
        return None
    hints = get_paper_subject_hints()
    pool = [
        pid
        for pid in catalog
        if is_online_practice_paper_id(pid) == online_practice
    ]
    if subject and pool:
        matched = [
            pid
            for pid in pool
            if subjects_match(hints.get(pid, ""), subject)
        ]
        if matched:
            pool = matched
    if not pool:
        return None
    return RNG.choice(pool)


def enrich_template_from_catalog(
    tpl: dict, paper_id: str, subject: str | None, online_practice: bool
) -> dict:
    pid = str(paper_id or tpl.get("paper_id") or "").strip()
    if not pid:
        picked = pick_catalog_paper_id(subject, online_practice)
        if picked:
            pid = picked
    entry = get_paper_catalog_entry(pid)
    out = dict(tpl)
    out["paper_id"] = pid
    if entry:
        out["total_questions"] = entry["total"]
    if subject and not out.get("subject"):
        out["subject"] = subject
    return out


def pick_exam_template(subject: str | None = None) -> dict:
    catalog = get_paper_catalog()
    if catalog:
        pid = pick_catalog_paper_id(subject, online_practice=False)
        if pid:
            sample = next(
                (r for r in get_exam_sample_rows() if str(r.get("paper_id")) == pid),
                None,
            )
            entry = get_paper_catalog_entry(pid)
            return {
                "paper_id": pid,
                "paper_name": (sample or {}).get("paper_name") or "",
                "subject": subject or (sample or {}).get("subject") or "数学",
                "grade_level": (sample or {}).get("grade_level") or "高三",
                "scene": (sample or {}).get("scene") or "刷真题",
                "total_questions": entry["total"] if entry else 21,
            }
    rows = get_exam_sample_rows()
    if not rows:
        pid = pick_catalog_paper_id(subject, online_practice=False) or str(
            RNG.randint(45000000, 57999999)
        )
        total = catalog_paper_total(pid, RNG.choice([11, 12, 19, 20, 21, 22]))
        return {
            "paper_id": pid,
            "paper_name": "",
            "subject": subject or "数学",
            "grade_level": "初三",
            "scene": "刷真题",
            "total_questions": total,
        }
    pool = rows
    if subject:
        matched = [r for r in rows if subjects_match(r.get("subject", ""), subject)]
        if matched:
            pool = matched
    tpl = RNG.choice(pool)
    return enrich_template_from_catalog(tpl, tpl["paper_id"], subject, online_practice=False)


def build_paper_questions(exams: list, practices: list) -> list[dict]:
    max_q: dict[str, int] = {}
    meta: dict[str, str] = {}
    for row in exams + practices:
        pid = str(row["paper_id"])
        total = int(row["total_questions"])
        max_q[pid] = max(max_q.get(pid, 0), total)
        if pid not in meta:
            meta[pid] = row["subject"]
    out: list[dict] = []
    for pid in sorted(max_q.keys()):
        subject = meta.get(pid, "数学")
        bank_id = SUBJECT_BANK_ID.get(subject, "11")
        for no in range(1, max_q[pid] + 1):
            out.append(
                {
                    "paper_id": pid,
                    "question_no": no,
                    "qbm_id": pid,
                    "bank_id": bank_id,
                    "id": numeric_question_id(pid, no),
                }
            )
    return out


def gen_wrong_ids(total: int, wrong: int) -> str:
    if wrong <= 0 or total <= 0:
        return ""
    n = min(wrong, total)
    return ",".join(str(x) for x in sorted(RNG.sample(range(1, total + 1), n)))


def gen_wrong_question_ids(paper_id: str, total: int, wrong: int) -> str:
    """exam_detail / practice_detail.wrong_question_ids：优先 paper_questions.csv 中的 id"""
    if wrong <= 0 or total <= 0:
        return "null"
    entry = get_paper_catalog_entry(paper_id)
    if entry:
        total = int(entry["total"])
    n = min(wrong, total)
    nos = sorted(RNG.sample(range(1, total + 1), n))
    if entry:
        ids = [entry["id_by_no"][no] for no in nos if no in entry["id_by_no"]]
        if not ids:
            return "null"
        return ids[0] if len(ids) == 1 else ",".join(ids)
    ids = [numeric_question_id(paper_id, no) for no in nos]
    return ids[0] if len(ids) == 1 else ",".join(ids)


def calc_wrong(total: int, rate: float) -> tuple[int, float]:
    wrong = min(max(0, int(round(total * (1 - rate)))), total)
    if total == 0:
        return 0, 0.0
    actual = (total - wrong) / total
    if actual in (0.0, 1.0):
        return wrong, actual
    return wrong, round(actual, 4)


def exam_paper_name(grade: str, subject: str, kind: str) -> str:
    if kind == "月考" and subject == "数学":
        return f"2025年广州市{grade}数学9月月考卷"
    if kind == "月考":
        return f"2025年广州市{grade}{subject}9月月考卷"
    if kind == "阶段检测":
        return f"广州大学附属中学{grade}{subject}第一次阶段检测"
    if kind == "期中模拟":
        return f"{grade}{subject}上册期中模拟卷（一）"
    if kind == "期中真题":
        return f"2024年广州市{grade}{subject}期中真题卷"
    if kind == "期末模拟":
        return f"{grade}{subject}上册期末模拟卷"
    if kind == "开学检测":
        return f"广州大学附属中学{grade}{subject}开学检测卷"
    if kind == "中考模拟":
        return f"2025年广州市中考{subject}模拟卷（一）"
    if kind == "高考模拟":
        return f"2025年广东省高考{subject}模拟卷"
    if kind == "月考巩固":
        return f"{grade}{subject}月考后巩固卷"
    return f"{grade}{subject}{kind}卷"


def practice_paper_name(
    grade: str, subject: str, rf: int, scene: str, chapter: str, kp: str
) -> str:
    if rf == 2:
        return f"{grade}{subject} {kp} 在线练习"
    if rf == 3:
        if subject == "英语":
            return f"Unit3 Grammar 同步练习"
        if subject == "语文":
            return f"{chapter} 古诗词 单元检测"
        return f"{chapter} {kp} 课时练习（基础）"
    if rf == 102:
        if subject == "语文":
            return "古诗词默写 薄弱再练"
        return f"{kp} 薄弱再练"
    if rf == 4:
        return f"{grade}{subject} {chapter} 阶段复习练习"
    if rf == 5:
        return f"{grade}{subject}中考一轮 诊薄弱"
    if rf == 105:
        return f"{grade}{subject}中考一轮 精准练"
    return f"{grade}{subject} {scene}"


def date_only(dt: str) -> str:
    return dt.split()[0] if dt else ""


class Generator:
    def __init__(self, students: list[dict], inactive: set[str]) -> None:
        self.students = students
        self.inactive = inactive
        self.materials: list[dict] = []
        self.videos: list[dict] = []
        self.exams: list[dict] = []
        self.practices: list[dict] = []
        self.knowledge: list[dict] = []
        self.activity_days: dict[str, set[str]] = defaultdict(set)
        self.class_weak_kp: dict[tuple[str, str, str], list[tuple[str, str, str]]] = {}
        self._seq = 0

    def pid(self, prefix: str) -> str:
        self._seq += 1
        return f"{prefix}{self._seq:05d}"

    def mark_active(self, sid: str, dt: str) -> None:
        d = date_only(dt)
        if d:
            self.activity_days[sid].add(d)

    def setup_class_weak_points(self, school: str, grade: str, cls: str) -> None:
        subs = subjects_for_grade(grade)[:3]
        weak = []
        for subj in subs:
            kp = pick_sample_knowledge_point(subj)
            if not kp:
                _, kp = RNG.choice(SUBJECT_KP.get(subj, [("综合", "核心考点")]))
            weak.append((subj, "", kp))
        self.class_weak_kp[(school, grade, cls)] = weak

    def add_knowledge_for_paper(
        self,
        st: dict,
        paper_id: str,
        subject: str,
        judge_time: str,
    ) -> None:
        sid = st["student_id"]
        if sid in self.inactive:
            return
        pid = str(paper_id)
        jtime = format_judge_time(judge_time, sid, pid)
        template_kps = get_knowledge_points_for_paper(pid)
        if not template_kps:
            picks: list[dict] = []
            seen: set[str] = set()
            for _ in range(RNG.randint(2, 4)):
                _, kp = RNG.choice(SUBJECT_KP.get(subject, [("综合", "核心考点")]))
                if kp in seen:
                    continue
                seen.add(kp)
                picks.append({"subject": subject, "knowledge_point": kp})
            template_kps = picks or [{"subject": subject, "knowledge_point": "核心考点"}]

        weak_list = self.class_weak_kp.get(
            (st["school_name"], st["grade"], st["class_name"]), []
        )
        class_weak_names = {
            w[2] for w in weak_list if w[0] == subject and w[2]
        }
        template_names = [item["knowledge_point"] for item in template_kps]
        overlap = [name for name in template_names if name in class_weak_names]

        r = random.Random(f"{sid}:{pid}:km")
        weak_kp: str | None = None
        if overlap and r.random() < 0.55:
            weak_kp = r.choice(overlap)
        elif r.random() < 0.16:
            weak_kp = r.choice(template_names)

        for item in template_kps:
            kp = item["knowledge_point"]
            subj = normalize_knowledge_subject(item.get("subject", ""), subject)
            if weak_kp and kp == weak_kp:
                mastered = "未掌握"
            else:
                mastered = "已掌握"
            self.knowledge.append(
                {
                    "student_id": sid,
                    "paper_id": pid,
                    "subject": subj,
                    "knowledge_point": kp,
                    "is_mastered": mastered,
                    "judge_time": jtime,
                }
            )

    def add_exam(
        self,
        st: dict,
        paper_id: str,
        paper_name: str,
        subject: str,
        submit_time: str,
        rate: float | None = None,
        extra_kp: bool = True,
        template: dict | None = None,
        force_is_submit: str | None = None,
        allow_retry: bool = True,
    ) -> None:
        sid = st["student_id"]
        if sid in self.inactive:
            return
        tpl = template or pick_exam_template(subject)
        pid = str(
            paper_id
            or tpl.get("paper_id")
            or pick_catalog_paper_id(subject, online_practice=False)
            or RNG.randint(45000000, 57999999)
        )
        total = catalog_paper_total(
            pid, int(tpl.get("total_questions") or RNG.randint(19, 22))
        )
        scene = "刷真题"

        if force_is_submit:
            is_submit = force_is_submit
        else:
            is_submit = "已交卷" if RNG.random() > 0.35 else "未交卷仅在线练"

        if is_submit == "未交卷仅在线练":
            wrong = 0
            actual = 0
        else:
            r = rate if rate is not None else subject_rate(sid, subject)
            wrong, actual = calc_wrong(
                total, max(0.35, min(0.98, r + RNG.uniform(-0.08, 0.08)))
            )

        pname = paper_name
        if not pname or is_garbled_text(pname):
            pname = tpl.get("paper_name") or ""
        if not pname or is_garbled_text(pname):
            pname = exam_paper_name(st["grade"], subject, "刷真题")

        stime = format_exam_submit_time(submit_time, sid, pid)
        self.exams.append(
            {
                "student_id": sid,
                "paper_id": pid,
                "paper_name": pname,
                "subject": subject,
                "scene": scene,
                "is_submit": is_submit,
                "submit_time": stime,
                "total_questions": total,
                "wrong_count": wrong,
                "wrong_question_ids": gen_wrong_question_ids(pid, total, wrong),
                "correct_rate": actual,
            }
        )
        if is_submit == "已交卷":
            self.mark_active(sid, submit_time)
            if extra_kp:
                self.add_knowledge_for_paper(st, pid, subject, submit_time)
            if allow_retry and RNG.random() < 0.12:
                r2 = random.Random(f"{sid}:{pid}:retry")
                day = date.fromisoformat(date_only(submit_time))
                day2 = (day + timedelta(days=r2.randint(1, 5))).isoformat()
                if day2 <= DATE_STRS[-1]:
                    stime2 = to_datetime(day2, sid, f"{pid}:retry")
                    self.add_exam(
                        st,
                        pid,
                        pname,
                        subject,
                        stime2,
                        template=tpl,
                        extra_kp=False,
                        force_is_submit="未交卷仅在线练",
                        allow_retry=False,
                    )

    def add_practice(
        self,
        st: dict,
        paper_id: str,
        paper_name: str,
        subject: str,
        scene: str,
        chapter: str,
        kp: str,
        submit_time: str,
        rate: float | None = None,
        template: dict | None = None,
        force_is_submit: str | None = None,
        allow_retry: bool = True,
    ) -> None:
        sid = st["student_id"]
        if sid in self.inactive:
            return
        tpl = template or pick_practice_template(subject, scene)
        pid = str(
            paper_id
            or tpl.get("paper_id")
            or pick_catalog_paper_id(subject, online_practice=True)
            or self.pid("4QJR")
        )
        scene_val = scene or tpl.get("scene") or "同步学在线练"
        total = catalog_paper_total(
            pid, int(tpl.get("total_questions") or RNG.randint(4, 10))
        )

        if force_is_submit:
            is_submit = force_is_submit
        else:
            is_submit = "已交卷" if RNG.random() > 0.2 else "未交卷"

        if is_submit == "未交卷":
            wrong = 0
            actual = 0
        else:
            r = rate if rate is not None else subject_rate(sid, subject)
            wrong, actual = calc_wrong(
                total, max(0.38, min(0.99, r + RNG.uniform(-0.1, 0.1)))
            )

        pname = paper_name
        if not pname or is_garbled_text(pname):
            pname = tpl.get("paper_name") or ""
        if not pname or is_garbled_text(pname):
            pname = practice_paper_name(
                st["grade"], subject, 3, scene_val, chapter, kp
            )

        self.practices.append(
            {
                "student_id": sid,
                "paper_id": pid,
                "paper_name": pname,
                "subject": subject,
                "scene": scene_val,
                "is_submit": is_submit,
                "submit_time": format_exam_submit_time(submit_time, sid, pid),
                "total_questions": total,
                "wrong_count": wrong,
                "wrong_question_ids": gen_wrong_question_ids(pid, total, wrong),
                "correct_rate": actual,
            }
        )
        if is_submit == "已交卷":
            self.mark_active(sid, submit_time)
            if allow_retry and RNG.random() < 0.1:
                r2 = random.Random(f"{sid}:{pid}:pretry")
                day = date.fromisoformat(date_only(submit_time))
                day2 = (day + timedelta(days=r2.randint(0, 2))).isoformat()
                if day2 <= DATE_STRS[-1]:
                    stime2 = to_datetime(day2, sid, f"{pid}:pretry")
                    self.add_practice(
                        st,
                        pid,
                        pname,
                        subject,
                        scene_val,
                        chapter,
                        kp,
                        stime2,
                        template=tpl,
                        force_is_submit="未交卷",
                        allow_retry=False,
                    )
            self.add_knowledge_for_paper(st, pid, subject, submit_time)

    def class_shared_exams(self, grade: str) -> list[dict]:
        """班级共卷：paper_id / 题量参考 exam_detail样例.csv"""
        subs = subjects_for_grade(grade)
        kinds = [
            "开学检测",
            "阶段检测",
            "月考",
            "月考巩固",
            "阶段检测",
            "期中模拟",
            "期中真题",
            "期末模拟",
        ]
        picks: list[dict] = []
        used_pids: set[str] = set()
        used_subj: set[str] = set()

        def append_pick(subj: str, kind: str, wi: int) -> None:
            tpl = pick_exam_template(subj)
            pid = tpl["paper_id"]
            tries = 0
            while pid in used_pids and tries < 20:
                tpl = pick_exam_template(subj)
                pid = tpl["paper_id"]
                tries += 1
            used_pids.add(pid)
            picks.append(
                {
                    "template": tpl,
                    "paper_id": pid,
                    "paper_name": exam_paper_name(grade, subj, kind),
                    "subject": subj,
                    "kind": kind,
                    "window": EXAM_WINDOWS[wi % len(EXAM_WINDOWS)],
                }
            )

        if "数学" in subs:
            used_subj.add("数学")
            append_pick("数学", "月考", 2)

        for subj in subs:
            if len(picks) >= 8:
                break
            if subj in used_subj:
                continue
            used_subj.add(subj)
            wi = len(picks) % len(EXAM_WINDOWS)
            kind = kinds[len(picks) % len(kinds)]
            if kind == "中考模拟" and not is_senior_grade(grade):
                kind = "阶段检测"
            if kind == "高考模拟" and grade != "高三":
                kind = "期中模拟"
            append_pick(subj, kind, wi)

        if grade in ("初三", "九年级") and len(picks) < 8:
            append_pick("数学", "中考模拟", 5)
        if grade == "高三" and len(picks) < 8:
            append_pick("数学", "高考模拟", 5)
        return picks[:8]

    def class_shared_practices(self, grade: str) -> list[dict]:
        subs = subjects_for_grade(grade)
        scene_day_pools = [
            ("同步学在线练", DATE_STRS),
            ("同步学薄弱再练", [d for d in DATE_STRS if d >= "2025-09-14"]),
        ]
        if is_senior_grade(grade):
            scene_day_pools.append(
                (
                    "升学备考精准练",
                    [d for d in DATE_STRS if d >= "2025-09-22"],
                )
            )

        out: list[dict] = []
        used_pids: set[str] = set()
        for scene, day_pool in scene_day_pools:
            for subj in subs:
                if len(out) >= 8:
                    break
                tpl = pick_practice_template(subj, scene)
                pid = tpl["paper_id"]
                tries = 0
                while pid in used_pids and tries < 20:
                    tpl = pick_practice_template(subj, scene)
                    pid = tpl["paper_id"]
                    tries += 1
                used_pids.add(pid)
                ch, kp = RNG.choice(SUBJECT_KP.get(subj, [("综合", "核心考点")]))
                pname = tpl.get("paper_name") or practice_paper_name(
                    grade, subj, 3, tpl.get("scene") or scene, ch, kp
                )
                out.append(
                    {
                        "template": tpl,
                        "paper_id": pid,
                        "paper_name": pname,
                        "subject": subj,
                        "scene": tpl.get("scene") or scene,
                        "chapter": ch,
                        "knowledge_point": kp,
                        "day_pool": day_pool,
                    }
                )
            if len(out) >= 8:
                break
        return out[:8]

    def add_material(self, st: dict, subject: str) -> None:
        sid = st["student_id"]
        if sid in self.inactive:
            return
        day = spread_sep_day(sid, f"mat{subject}", DATE_STRS)
        self.materials.append(
            {
                "user_id": sid,
                "dt": day,
                "res_id": RNG.randint(47000000, 56000000),
                "subject_name": subject,
            }
        )
        self.mark_active(sid, day)

    def add_video(self, st: dict, subject: str) -> None:
        sid = st["student_id"]
        if sid in self.inactive:
            return
        day = spread_sep_day(sid, f"vid{subject}", DATE_STRS)
        self.videos.append(
            {
                "user_id": sid,
                "dt": day,
                "content_id": RNG.randint(50000000, 9999999999999999),
                "subject_name": subject,
            }
        )
        self.mark_active(sid, day)

    def run(self) -> None:
        by_class: dict[tuple[str, str, str], list[dict]] = defaultdict(list)
        for st in self.students:
            by_class[(st["school_name"], st["grade"], st["class_name"])].append(st)

        for key, members in by_class.items():
            school, grade, cls = key
            self.setup_class_weak_points(school, grade, cls)
            active = [m for m in members if m["student_id"] not in self.inactive]
            if not active:
                continue

            for ex in self.class_shared_exams(grade):
                win = ex["window"]
                for st in active:
                    if RNG.random() < 0.92:
                        stime = submit_in_window(win, st["student_id"], ex["paper_id"])
                        self.add_exam(
                            st,
                            ex["paper_id"],
                            ex["paper_name"],
                            ex["subject"],
                            stime,
                            template=ex.get("template"),
                        )

            for pr in self.class_shared_practices(grade):
                pool = pr["day_pool"]
                for st in active:
                    if RNG.random() < 0.9:
                        day = spread_sep_day(st["student_id"], pr["paper_id"], pool)
                        # 相邻0-2天
                        r = random.Random(f"{st['student_id']}:{pr['paper_id']}:off")
                        day = (
                            date.fromisoformat(day) + timedelta(days=r.randint(0, 2))
                        ).isoformat()
                        if day > DATE_STRS[-1]:
                            day = DATE_STRS[-1]
                        stime = to_datetime(day, st["student_id"], pr["paper_id"])
                        self.add_practice(
                            st,
                            pr["paper_id"],
                            pr["paper_name"],
                            pr["subject"],
                            pr["scene"],
                            pr["chapter"],
                            pr["knowledge_point"],
                            stime,
                            template=pr.get("template"),
                        )

        # 个人补充：同步学几乎每天都有
        sync_pool = DATE_STRS
        for st in self.students:
            if st["student_id"] in self.inactive:
                continue
            subs = subjects_for_grade(st["grade"])
            weights = student_weights(st["student_id"], subs)
            ranked = sorted(subs, key=lambda s: weights.get(s, 0.5), reverse=True)
            must = set(ranked[: min(4, len(ranked))])

            for subject in subs:
                w = weights.get(subject, 0.5)
                force = subject in must
                n_ex = max(0 if not force else 1, int(round(RNG.uniform(0, 1) * w)))
                n_sync = max(2 if force else 1, int(round(RNG.uniform(2, 6) * w)))
                n_mat = max(1 if force else 0, int(round(RNG.uniform(1, 3) * w)))
                n_vid = max(0, int(round(RNG.uniform(1, 2) * w)))

                for _ in range(n_ex):
                    wi = RNG.randint(0, len(EXAM_WINDOWS) - 1)
                    kind = RNG.choice(
                        ["开学检测", "月考巩固", "阶段检测", "期中模拟", "期末模拟"]
                    )
                    tpl = pick_exam_template(subject)
                    pid = tpl["paper_id"]
                    pname = exam_paper_name(st["grade"], subject, kind)
                    stime = submit_in_window(EXAM_WINDOWS[wi], st["student_id"], pid)
                    self.add_exam(
                        st, pid, pname, subject, stime, template=tpl
                    )

                for _ in range(n_sync):
                    ch, kp = RNG.choice(SUBJECT_KP.get(subject, [("综合", "核心考点")]))
                    tpl = pick_practice_template(subject, "同步学在线练")
                    scene = tpl.get("scene") or "同步学在线练"
                    pid = tpl["paper_id"]
                    day = spread_sep_day(st["student_id"], pid, sync_pool)
                    stime = to_datetime(day, st["student_id"], pid)
                    self.add_practice(
                        st,
                        pid,
                        tpl.get("paper_name") or "",
                        subject,
                        scene,
                        ch,
                        kp,
                        stime,
                        template=tpl,
                    )

                if force and RNG.random() < 0.6:
                    ch, kp = RNG.choice(SUBJECT_KP.get(subject, [("综合", "核心考点")]))
                    tpl = pick_practice_template(subject, "同步学薄弱再练")
                    scene = tpl.get("scene") or "同步学薄弱再练"
                    pid = tpl["paper_id"]
                    day = spread_sep_day(
                        st["student_id"], pid, [d for d in DATE_STRS if d >= "2025-09-15"]
                    )
                    self.add_practice(
                        st,
                        pid,
                        tpl.get("paper_name") or "",
                        subject,
                        scene,
                        ch,
                        kp,
                        to_datetime(day, st["student_id"], pid),
                        template=tpl,
                    )

                if force and RNG.random() < 0.45:
                    ch, kp = RNG.choice(SUBJECT_KP.get(subject, [("综合", "核心考点")]))
                    tpl = pick_practice_template(subject, "同步学在线练")
                    scene = tpl.get("scene") or "同步学在线练"
                    pid = tpl["paper_id"]
                    day = spread_sep_day(
                        st["student_id"], pid, [d for d in DATE_STRS if d >= "2025-09-20"]
                    )
                    self.add_practice(
                        st,
                        pid,
                        tpl.get("paper_name") or "",
                        subject,
                        scene,
                        ch,
                        kp,
                        to_datetime(day, st["student_id"], pid),
                        template=tpl,
                    )

                if is_senior_grade(st["grade"]) and force and RNG.random() < 0.35:
                    ch, kp = RNG.choice(SUBJECT_KP.get(subject, [("综合", "核心考点")]))
                    tpl = pick_practice_template(subject, "升学备考精准练")
                    scene = normalize_scene(tpl.get("scene") or "升学备考精准练")
                    pid = tpl["paper_id"]
                    day = spread_sep_day(
                        st["student_id"], pid, [d for d in DATE_STRS if d >= "2025-09-22"]
                    )
                    self.add_practice(
                        st,
                        pid,
                        tpl.get("paper_name") or "",
                        subject,
                        scene,
                        ch,
                        kp,
                        to_datetime(day, st["student_id"], pid),
                        template=tpl,
                    )

                for _ in range(n_mat):
                    self.add_material(st, subject)
                for _ in range(n_vid):
                    self.add_video(st, subject)


def build_daily_active(students: list[dict], activity_days: dict[str, set[str]]) -> list[dict]:
    rows = []
    for st in students:
        sid = st["student_id"]
        days = activity_days.get(sid, set())
        for d in DATE_STRS:
            active = d in days
            if active:
                duration = round(random.Random(f"{sid}:{d}:dur").uniform(0.5, 12.0), 2)
            else:
                duration = 0
            rows.append(
                {
                    "user_id": sid,
                    "dt": d,
                    "is_active": 1 if active else 0,
                    "learning_duration_min": duration,
                }
            )
    return rows


def build_usage(
    students: list[dict],
    inactive: set[str],
    materials: list[dict],
    videos: list[dict],
    exams: list[dict],
    practices: list[dict],
) -> list[dict]:
    mc = defaultdict(int)
    vc = defaultdict(int)
    pc = defaultdict(int)
    ec = defaultdict(set)
    for m in materials:
        mc[m.get("user_id") or m["student_id"]] += 1
    for v in videos:
        vc[v.get("user_id") or v["student_id"]] += 1
    for p in practices:
        pc[p["student_id"]] += 1
    for e in exams:
        ec[e["student_id"]].add(e["paper_id"])

    rows = []
    for st in students:
        sid = st["student_id"]
        if sid in inactive:
            rows.append(
                {
                    "学生编号": sid,
                    "浏览次数": 0,
                    "观看次数": 0,
                    "观看时长_秒": 0,
                    "练习次数": 0,
                    "下载次数": 0,
                    "拍搜次数": 0,
                    "伴学次数": 0,
                }
            )
        else:
            rows.append(
                {
                    "学生编号": sid,
                    "浏览次数": mc[sid],
                    "观看次数": vc[sid],
                    "观看时长_秒": vc[sid] * RNG.randint(400, 1200),
                    "练习次数": pc[sid],
                    "下载次数": RNG.randint(0, 8),
                    "拍搜次数": RNG.randint(0, 6),
                    "伴学次数": RNG.randint(0, 3),
                }
            )
    return rows


def avg_rate(rows: list[dict]) -> float | None:
    tq = sum(int(r["total_questions"]) for r in rows)
    if not tq:
        return None
    ok = sum(int(r["total_questions"]) - int(r["wrong_count"]) for r in rows)
    return round(ok / tq, 4)


def main() -> None:
    (DATA / "后台管理账号维护表.csv").write_text(
        ACCOUNTS_CSV.strip() + "\n", encoding="utf-8-sig"
    )

    students = read_students()
    inactive = pick_inactive(students)
    print(f"未参与学习 {len(inactive)} 人: {sorted(inactive)}")

    catalog = load_paper_questions_catalog()
    if catalog:
        q_count = sum(int(v["total"]) for v in catalog.values())
        print(f"paper_questions 真实题库: {len(catalog)} 卷 / {q_count} 题映射")
    else:
        print("paper_questions 未找到，将按 mock 规则生成")

    gen = Generator(students, inactive)
    gen.run()

    daily = build_daily_active(students, gen.activity_days)
    usage = build_usage(students, inactive, gen.materials, gen.videos, gen.exams, gen.practices)

    write_csv(
        DATA / "students.csv",
        ["学生编号", "姓名", "学校", "校区", "年级", "班级"],
        [
            {
                "学生编号": s["student_id"],
                "姓名": s["student_name"],
                "学校": s["school_name"],
                "校区": s["campus"],
                "年级": s["grade"],
                "班级": s["class_name"],
            }
            for s in students
        ],
    )

    write_csv(
        DATA / "material_detail.csv",
        ["user_id", "dt", "res_id", "subject_name"],
        gen.materials,
    )
    write_csv(
        DATA / "video_detail.csv",
        [
            "user_id",
            "dt",
            "content_id",
            "subject_name",
        ],
        gen.videos,
    )
    write_csv(
        DATA / "exam_detail.csv",
        [
            "student_id",
            "paper_id",
            "paper_name",
            "subject",
            "scene",
            "is_submit",
            "submit_time",
            "total_questions",
            "wrong_count",
            "wrong_question_ids",
            "correct_rate",
        ],
        gen.exams,
    )
    write_csv(
        DATA / "practice_detail.csv",
        [
            "student_id",
            "paper_id",
            "paper_name",
            "subject",
            "scene",
            "is_submit",
            "submit_time",
            "total_questions",
            "wrong_count",
            "wrong_question_ids",
            "correct_rate",
        ],
        gen.practices,
    )
    write_csv(
        DATA / "knowledge_mastery.csv",
        [
            "student_id",
            "paper_id",
            "subject",
            "knowledge_point",
            "is_mastered",
            "judge_time",
        ],
        gen.knowledge,
    )
    if PAPER_QUESTIONS_PATH.is_file() and catalog:
        print(f"  paper_questions: 保留现有真实数据 {len(catalog)} 卷")
    else:
        paper_questions = build_paper_questions(gen.exams, gen.practices)
        write_csv(
            DATA / "paper_questions.csv",
            ["paper_id", "question_no", "qbm_id", "bank_id", "id"],
            paper_questions,
        )
        print(f"  paper_questions: {len(paper_questions)}")
    write_csv(
        DATA / "usage_summary.csv",
        [
            "学生编号",
            "浏览次数",
            "观看次数",
            "观看时长_秒",
            "练习次数",
            "下载次数",
            "拍搜次数",
            "伴学次数",
        ],
        usage,
    )
    write_csv(
        DATA / "daily_active.csv",
        ["user_id", "dt", "is_active", "learning_duration_min"],
        daily,
    )

    hw = DATA / "homework_detail.csv"
    if hw.exists():
        hw.unlink()
    for obsolete in ("student_list.csv", "accounts.csv"):
        path = DATA / obsolete
        if path.exists():
            path.unlink()

    print("生成完成:")
    print(f"  exam_sample_templates: {len(get_exam_sample_rows())}")
    print(f"  practice_sample_templates: {len(get_practice_sample_rows())}")
    print(f"  knowledge_sample_templates: {len(get_knowledge_paper_templates())}")
    print(f"  material: {len(gen.materials)}")
    print(f"  video: {len(gen.videos)}")
    print(f"  exam: {len(gen.exams)}")
    print(f"  practice: {len(gen.practices)}")
    print(f"  knowledge: {len(gen.knowledge)}")
    print(f"  daily_active: 已按明细活动日重算")


if __name__ == "__main__":
    main()
