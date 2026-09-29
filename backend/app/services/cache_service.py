# خدمة الكاش - تقليل تكلفة Gemini
import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Optional, Any
from app.database import get_supabase
import logging

logger = logging.getLogger(__name__)

# TTL بالساعات
CHAT_TTL_HOURS = 24
SUMMARY_TTL_HOURS = 168  # أسبوع


def make_cache_key(content_type: str, *parts: str) -> str:
    """توليد مفتاح كاش فريد"""
    combined = f"{content_type}:{'|'.join(str(p) for p in parts)}"
    return hashlib.sha256(combined.encode()).hexdigest()


async def get_cached(cache_key: str) -> Optional[Any]:
    """جلب محتوى من الكاش"""
    try:
        db = get_supabase()
        now = datetime.now(timezone.utc).isoformat()
        result = db.table("content_cache").select("*") \
            .eq("cache_key", cache_key) \
            .gt("expires_at", now) \
            .execute()

        if result.data:
            # زيادة عداد الاستخدام
            db.table("content_cache") \
                .update({"hit_count": result.data[0]["hit_count"] + 1}) \
                .eq("cache_key", cache_key) \
                .execute()
            return result.data[0]["content"]
    except Exception as e:
        logger.warning(f"خطأ في قراءة الكاش: {e}")
    return None


async def set_cached(cache_key: str, content_type: str, content: Any, ttl_hours: int = CHAT_TTL_HOURS):
    """حفظ محتوى في الكاش"""
    try:
        db = get_supabase()
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=ttl_hours)).isoformat()

        db.table("content_cache").upsert({
            "cache_key": cache_key,
            "content_type": content_type,
            "content": content if isinstance(content, dict) else {"text": content},
            "hit_count": 0,
            "expires_at": expires_at
        }).execute()
    except Exception as e:
        logger.warning(f"خطأ في حفظ الكاش: {e}")


async def clear_expired_cache():
    """حذف الكاش المنتهي"""
    try:
        db = get_supabase()
        now = datetime.now(timezone.utc).isoformat()
        db.table("content_cache").delete().lt("expires_at", now).execute()
    except Exception as e:
        logger.warning(f"خطأ في تنظيف الكاش: {e}")
