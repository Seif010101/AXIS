# نقطة الدخول الرئيسية - Morix Platform Backend
import warnings
warnings.filterwarnings("ignore", ".*bcrypt.*")
warnings.filterwarnings("ignore", ".*error reading bcrypt version.*")

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from app.config import settings
from app.routers import auth, manager, student, ai, teacher, owner, admin
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

# ── تحذير أمني عند استخدام JWT secret ضعيف ────────────────────────────
_WEAK_JWT_SECRETS = {
    "",
    "memorix-default-secret",
    "memorix-super-secret-jwt-key-2024-change-in-production",
    "secret", "changeme", "password",
}
if settings.jwt_secret_key in _WEAK_JWT_SECRETS:
    logging.warning("⚠️  JWT_SECRET_KEY يستخدم قيمة افتراضية غير آمنة! غيّرها في .env قبل النشر للإنتاج.")

# ── وضع الإنتاج من متغير البيئة ─────────────────────────────────────────
_IS_PRODUCTION = os.getenv("ENVIRONMENT", "development").lower() == "production"

app = FastAPI(
    title="Morix API",
    description="منصة Morix للتعلم الذكي - API",
    version=settings.app_version,
    # إخفاء التوثيق في الإنتاج لتقليل سطح الهجوم
    docs_url=None if _IS_PRODUCTION else "/docs",
    redoc_url=None if _IS_PRODUCTION else "/redoc",
    openapi_url=None if _IS_PRODUCTION else "/openapi.json",
)

from fastapi import Request
from fastapi.responses import JSONResponse, Response
import traceback


# ── Security Headers Middleware ──────────────────────────────────────────
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        # بروكسي المكتبة يحتاج عرض محتوى خارجي داخل iframe — لا نفرض X-Frame-Options: DENY عليه
        if not request.url.path.startswith("/api/v1/proxy"):
            response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        if _IS_PRODUCTION:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response

app.add_middleware(SecurityHeadersMiddleware)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # لوج الخطأ الكامل في السيرفر فقط — لا نُرسل التفاصيل للعميل
    logging.error(f"Unhandled error on {request.method} {request.url.path}: {traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={"detail": "حدث خطأ داخلي في الخادم. تواصل مع الدعم الفني."}
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "https://morix.tech",
        "https://www.morix.tech",
        "https://morix-srqw.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    # تحديد الـ methods المسموحة فقط بدل *
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(manager.router, prefix="/api/v1")
app.include_router(student.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(teacher.router, prefix="/api/v1")
app.include_router(owner.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "ok", "app": "Morix", "version": settings.app_version}


@app.get("/api/v1/system-check")
async def system_check(request: Request):
    """فحص شامل لمكونات المنصة — للمالك فقط"""
    # التحقق من التوكن يدوياً (بدون Depends لأن الـ endpoint خارج الـ routers)
    from fastapi.security import HTTPBearer
    from app.auth import decode_token
    from app.database import get_supabase
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JSONResponse(status_code=401, content={"detail": "يجب تسجيل الدخول"})
    try:
        payload = decode_token(auth_header.split(" ", 1)[1])
        if payload.get("role") != "owner":
            return JSONResponse(status_code=403, content={"detail": "هذا الفحص للمالك فقط"})
    except Exception:
        return JSONResponse(status_code=401, content={"detail": "رمز وصول غير صالح"})
    checks = {"timestamp": None, "checks": {}}
    from datetime import datetime, timezone
    checks["timestamp"] = datetime.now(timezone.utc).isoformat()

    # 1) Supabase
    try:
        from app.database import get_supabase
        db = get_supabase()
        r = db.table("users").select("id", count="exact").limit(1).execute()
        checks["checks"]["supabase"] = {"ok": True, "users_count": r.count}
    except Exception as e:
        checks["checks"]["supabase"] = {"ok": False, "error": str(e)[:200]}

    # 2) Gemini API key validity
    try:
        from app.services.ai_service import chat_with_gemini
        text, _ = await chat_with_gemini("ping", None, full_name="System")
        if "leaked" in text.lower() or "غير صالح" in text or "تعذر" in text:
            checks["checks"]["gemini"] = {"ok": False, "message": text[:300]}
        else:
            checks["checks"]["gemini"] = {"ok": True, "sample_reply": text[:100]}
    except Exception as e:
        checks["checks"]["gemini"] = {"ok": False, "error": str(e)[:200]}

    # 3) Env vars present
    checks["checks"]["env"] = {
        "supabase_url": bool(settings.supabase_url),
        "supabase_key": bool(settings.supabase_service_key or settings.supabase_anon_key),
        "gemini_key": bool(settings.gemini_api_key),
        "jwt_secret": bool(settings.jwt_secret_key and settings.jwt_secret_key != "memorix-default-secret"),
    }

    overall_ok = all([
        checks["checks"].get("supabase", {}).get("ok"),
        checks["checks"].get("gemini", {}).get("ok"),
        all(checks["checks"]["env"].values()),
    ])
    checks["overall"] = "✅ كل شيء شغّال" if overall_ok else "⚠️ في مشاكل"
    return checks


@app.get("/")
async def root():
    info = {"message": "مرحباً بك في Morix API - منصة التعلم الذكي", "version": settings.app_version}
    if not _IS_PRODUCTION:
        info["docs"] = "/docs"
    return info


# ============================================================
# 🌐 Iframe Proxy — يحذف headers اللي بتمنع التضمين
# ============================================================
from fastapi import Request, Query
from fastapi.responses import Response, StreamingResponse
import httpx
from urllib.parse import urlparse, urljoin, quote

ALLOWED_HOSTS = {
    "hindawi.org", "www.hindawi.org",
    "noor-book.com", "www.noor-book.com",
    "shamela.ws", "www.shamela.ws",
    "openlibrary.org", "www.openlibrary.org",
    "archive.org", "www.archive.org",
    "gutenberg.org", "www.gutenberg.org",
    "eric.ed.gov",
    "ar.wikibooks.org", "ar.wikipedia.org", "ar.wikisource.org",
    "books.google.com", "books.google.com.eg",
    "kotobati.org", "www.kotobati.org",
    "wdl.org", "www.wdl.org",
}

STRIP_HEADERS = {
    "x-frame-options", "content-security-policy",
    "content-security-policy-report-only", "frame-options",
    "cross-origin-opener-policy", "cross-origin-embedder-policy",
    "cross-origin-resource-policy", "permissions-policy",
}


@app.get("/api/v1/proxy")
async def iframe_proxy(url: str = Query(...), token: str = Query(None), request: Request = None):
    """يجيب صفحة خارجية ويحذف headers اللي بتمنع التضمين في iframe — يتطلب تسجيل دخول.
    التوكن يأتي إما من هيدر Authorization أو من باراميتر token في الـ URL
    (لأن الـ iframe لا يستطيع إرسال هيدرز مخصّصة)."""
    # ─── التحقق من الـ JWT ────────────────────────────────────────────
    from app.auth import decode_token
    auth_header = (request.headers.get("Authorization") or "") if request else ""
    jwt_token = None
    if auth_header.startswith("Bearer "):
        jwt_token = auth_header.split(" ", 1)[1]
    elif token:
        jwt_token = token
    if not jwt_token:
        return Response(
            content="<html dir='rtl'><body style='font-family:sans-serif;padding:24px;background:#0f172a;color:#fff'><h2>🔒 يجب تسجيل الدخول لاستخدام هذه الميزة</h2></body></html>",
            media_type="text/html; charset=utf-8", status_code=401
        )
    try:
        decode_token(jwt_token)
    except Exception:
        return Response(
            content="<html dir='rtl'><body style='font-family:sans-serif;padding:24px;background:#0f172a;color:#fff'><h2>🔒 رمز وصول غير صالح</h2></body></html>",
            media_type="text/html; charset=utf-8", status_code=401
        )
    # ─── التحقق من الـ URL ────────────────────────────────────────────
    try:
        parsed = urlparse(url)
        # يجب أن يكون البروتوكول http أو https فقط (منع SSRF عبر file://, ftp:// إلخ)
        if parsed.scheme not in ("http", "https"):
            return Response(content="<html><body>بروتوكول غير مسموح</body></html>",
                            media_type="text/html; charset=utf-8", status_code=400)
        host = (parsed.hostname or "").lower()
        # فحص صارم: المضيف يجب أن يكون في ALLOWED_HOSTS بالضبط (بدون fallback للـ base domain)
        if host not in ALLOWED_HOSTS:
            return Response(content=f"<html dir='rtl'><body style='font-family:sans-serif;padding:24px;background:#0f172a;color:#fff'><h2>🚫 هذا الموقع غير مدعوم في البروكسي</h2><p>{host}</p><p><a style='color:#6366f1' href='{url}' target='_blank'>افتح الموقع في تبويب جديد</a></p></body></html>",
                            media_type="text/html; charset=utf-8")
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
            r = await client.get(url, headers={"User-Agent": ua, "Accept-Language": "ar,en;q=0.8"})
        ctype = r.headers.get("content-type", "text/html; charset=utf-8")
        body = r.content
        # نعدّل الـ HTML: نحذف meta CSP + نضيف base href
        if "text/html" in ctype.lower():
            try:
                text = body.decode(r.encoding or "utf-8", errors="replace")
                proxy_base = "/api/v1/proxy?url="
                origin = f"{parsed.scheme}://{parsed.netloc}"
                # نضيف base tag لجعل الروابط النسبية تشتغل
                base_tag = f'<base href="{origin}/">'
                if "<head>" in text.lower():
                    import re
                    text = re.sub(r"(?i)<head[^>]*>", lambda m: m.group(0) + base_tag, text, count=1)
                # حذف meta CSP
                text = re.sub(r'(?i)<meta[^>]*http-equiv\s*=\s*["\']content-security-policy["\'][^>]*>', "", text)
                text = re.sub(r'(?i)<meta[^>]*http-equiv\s*=\s*["\']x-frame-options["\'][^>]*>', "", text)
                # نحوّل الـ <a href> اللي يفتح في نفس الموقع لتمشي عبر الـ proxy
                # ونحتفظ بالتوكن في الروابط حتى يبقى التنقّل داخل المكتبة مُصرَّحاً به
                token_suffix = f"&token={jwt_token}" if jwt_token else ""
                def rewrite_link(m):
                    href = m.group(2)
                    if href.startswith("#") or href.startswith("javascript:") or href.startswith("mailto:"):
                        return m.group(0)
                    full = urljoin(url, href)
                    return f'{m.group(1)}href="{proxy_base}{quote(full, safe="")}{token_suffix}"'
                text = re.sub(r'(<a\s[^>]*?)href="([^"]+)"', rewrite_link, text)
                body = text.encode("utf-8")
                ctype = "text/html; charset=utf-8"
            except Exception as e:
                logging.warning(f"HTML rewrite failed: {e}")
        # حذف الـ headers الممنوعة
        out_headers = {}
        for k, v in r.headers.items():
            if k.lower() in STRIP_HEADERS or k.lower().startswith("set-cookie"):
                continue
            if k.lower() in ("content-encoding", "content-length", "transfer-encoding"):
                continue
            out_headers[k] = v
        out_headers["Content-Type"] = ctype
        out_headers["X-Frame-Options"] = "ALLOWALL"
        return Response(content=body, status_code=r.status_code, headers=out_headers, media_type=ctype)
    except Exception as e:
        logging.error(f"Proxy failed: {e}")
        return Response(
            content=f"<html dir='rtl'><body style='font-family:sans-serif;padding:24px;background:#0f172a;color:#fff'><h2>⚠️ تعذر تحميل الصفحة</h2><p>{str(e)[:200]}</p><p><a style='color:#6366f1' href='{url}' target='_blank'>افتح الرابط مباشرة</a></p></body></html>",
            media_type="text/html; charset=utf-8",
            status_code=200,
        )
