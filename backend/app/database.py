# اتصال قاعدة البيانات - Supabase
from supabase import create_client, Client
from app.config import settings
import logging

logger = logging.getLogger(__name__)

_supabase_client: Client | None = None


def get_supabase() -> Client:
    """الحصول على عميل Supabase"""
    global _supabase_client
    if _supabase_client is None:
        if not settings.supabase_url or settings.supabase_url == "YOUR_SUPABASE_URL":
            raise RuntimeError("SUPABASE_URL غير مضبوط في ملف .env")
        _supabase_client = create_client(
            settings.supabase_url,
            settings.supabase_service_key or settings.supabase_anon_key
        )
    return _supabase_client


def get_db() -> Client:
    """dependency للحصول على قاعدة البيانات"""
    return get_supabase()
