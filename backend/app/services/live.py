# جلسات البث المباشر (Jitsi) — مخزّنة كـ JSON في جدول runtime_config (بدون جدول جديد)
import json
import uuid
import logging
from datetime import datetime, timezone
from app.database import get_supabase

logger = logging.getLogger(__name__)
_KEY = "live_sessions"


def _read() -> list:
    try:
        r = get_supabase().table("runtime_config").select("value").eq("key", _KEY).execute()
        if r.data and r.data[0].get("value"):
            return json.loads(r.data[0]["value"]) or []
    except Exception as e:
        logger.warning(f"live read failed: {e}")
    return []


def _write(sessions: list) -> None:
    try:
        get_supabase().table("runtime_config").upsert(
            {"key": _KEY, "value": json.dumps(sessions, ensure_ascii=False)}, on_conflict="key"
        ).execute()
    except Exception as e:
        logger.warning(f"live write failed: {e}")


def list_all() -> list:
    return _read()


def start(host_id: str, host_name: str, grade: str, section: str, subject: str) -> dict:
    """يبدأ بثاً جديداً للمضيف (يُنهي أي بث سابق له)."""
    sessions = [s for s in _read() if s.get("host_id") != host_id]
    s = {
        "id": uuid.uuid4().hex,
        "room": "morix_" + uuid.uuid4().hex[:18],
        "host_id": host_id,
        "host_name": host_name or "",
        "grade": (grade or "").strip(),
        "section": (section or "").strip(),
        "subject": (subject or "").strip(),
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    sessions.append(s)
    _write(sessions)
    return s


def end(host_id: str = None, session_id: str = None) -> None:
    sessions = [
        s for s in _read()
        if not ((host_id and s.get("host_id") == host_id) or (session_id and s.get("id") == session_id))
    ]
    _write(sessions)


def for_student(grade: str, section: str) -> list:
    """البثوث النشطة المطابقة لصف/شعبة الطالب (أو العامة بدون شعبة محددة)."""
    g = (grade or "").strip()
    sec = (section or "").strip()
    out = []
    for s in _read():
        sg = (s.get("grade") or "").strip()
        ss = (s.get("section") or "").strip()
        if (not sg or sg == g) and (not ss or ss == sec):
            out.append(s)
    return out
