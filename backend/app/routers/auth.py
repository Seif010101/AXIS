# راوتر المصادقة
from fastapi import APIRouter, HTTPException, Depends, status, Request
from app.models.schemas import LoginRequest, TokenResponse, ChangePasswordRequest
from app.auth import (
    validate_memorix_email, verify_password, create_access_token,
    hash_password, get_current_user
)
from app.database import get_db
from app.config import settings
import logging
from datetime import datetime, timezone
from collections import defaultdict
import time

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["المصادقة"])

# ── Rate Limiter بسيط في الذاكرة للـ login ───────────────────────────────
# الحد: 10 محاولات كل 5 دقائق لكل IP
_LOGIN_ATTEMPTS: dict[str, list[float]] = defaultdict(list)
_MAX_ATTEMPTS = 10
_WINDOW_SECONDS = 300  # 5 دقائق


def _check_rate_limit(ip: str):
    now = time.time()
    window_start = now - _WINDOW_SECONDS
    # نحذف المحاولات القديمة
    _LOGIN_ATTEMPTS[ip] = [t for t in _LOGIN_ATTEMPTS[ip] if t > window_start]
    if len(_LOGIN_ATTEMPTS[ip]) >= _MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="تجاوزت عدد محاولات تسجيل الدخول المسموحة. انتظر 5 دقائق وأعد المحاولة.",
            headers={"Retry-After": "300"}
        )
    _LOGIN_ATTEMPTS[ip].append(now)


def _update_streak(user_id: str, db):
    from datetime import date as _date
    today = _date.today()
    streak = db.table("streaks").select("*").eq("user_id", user_id).execute()

    if not streak.data:
        db.table("streaks").insert({
            "user_id": user_id,
            "current_streak": 1,
            "longest_streak": 1,
            "last_login_date": today.isoformat(),
            "total_stars": 50
        }).execute()
        db.table("users").update({"stars_count": 50, "streak_count": 1}).eq("id", user_id).execute()
        return

    s = streak.data[0]
    last_date_str = s.get("last_login_date")
    if not last_date_str:
        db.table("streaks").update({
            "current_streak": 1, "last_login_date": today.isoformat(),
            "total_stars": s["total_stars"] + 50
        }).eq("user_id", user_id).execute()
        return

    last = _date.fromisoformat(str(last_date_str))
    diff = (today - last).days

    if diff == 0:
        return  # تسجيل دخول مكرر اليوم
    elif diff == 1:
        new_streak = s["current_streak"] + 1
        new_stars = s["total_stars"] + 50
        db.table("streaks").update({
            "current_streak": new_streak,
            "longest_streak": max(new_streak, s["longest_streak"]),
            "last_login_date": today.isoformat(),
            "total_stars": new_stars
        }).eq("user_id", user_id).execute()
        db.table("users").update({"stars_count": new_stars, "streak_count": new_streak}).eq("id", user_id).execute()
    else:
        new_stars = s["total_stars"] + 50
        db.table("streaks").update({
            "current_streak": 1,
            "last_login_date": today.isoformat(),
            "total_stars": new_stars
        }).eq("user_id", user_id).execute()
        db.table("users").update({"stars_count": new_stars, "streak_count": 1}).eq("id", user_id).execute()


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, http_request: Request, db=Depends(get_db)):
    """تسجيل الدخول - يرفض أي إيميل لا ينتهي بـ @morix.tech"""

    # ── Rate Limiting ──
    client_ip = http_request.client.host if http_request.client else "unknown"
    _check_rate_limit(client_ip)

    # التحقق من الدومين أولاً
    if not validate_memorix_email(request.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"الإيميل لازم يكون @{settings.allowed_email_domain} — الحسابات المسموحة من منصة Morix فقط"
        )

    # البحث عن المستخدم
    result = db.table("users").select("*").eq("email", request.email.lower()).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="الإيميل أو كلمة المرور غلط"
        )

    user = result.data[0]

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="الحساب معطل - تواصل مع المدير"
        )

    if not verify_password(request.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="الإيميل أو كلمة المرور غلط"
        )

    # إنشاء التوكن
    token = create_access_token({"sub": user["id"], "role": user["role"]})

    # تحديث last_login في users (مهم لإحصائيات النشاط)
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        db.table("users").update({"last_login": now_iso}).eq("id", user["id"]).execute()
        user["last_login"] = now_iso
    except Exception as e:
        logger.warning(f"last_login update failed: {e}")

    # تسجيل حدث الدخول في الإحصائيات
    try:
        db.table("analytics").insert({
            "student_id": user["id"],
            "school_id": user.get("school_id"),
            "event_type": "login",
            "event_data": {"role": user["role"]}
        }).execute()
    except Exception:
        pass

    # تحديث الـ streak للطلاب فقط
    if user["role"] == "student":
        try:
            _update_streak(user["id"], db)
        except Exception as e:
            logger.warning(f"Streak update failed: {e}")

    # إخفاء كلمة المرور من الرد
    user_data = {k: v for k, v in user.items() if k != "password_hash"}

    return TokenResponse(access_token=token, user=user_data)


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """تغيير كلمة المرور"""
    if not verify_password(request.old_password, current_user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="كلمة المرور الحالية غلط"
        )

    if len(request.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="كلمة المرور الجديدة لازم تكون 6 أحرف على الأقل"
        )

    new_hash = hash_password(request.new_password)
    db.table("users").update({
        "password_hash": new_hash,
        "must_change_password": False
    }).eq("id", current_user["id"]).execute()

    return {"message": "تم تغيير كلمة المرور بنجاح"}


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """معلومات المستخدم الحالي"""
    return {k: v for k, v in current_user.items() if k != "password_hash"}


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    """تسجيل الخروج"""
    try:
        db.table("analytics").insert({
            "student_id": current_user["id"],
            "school_id": current_user.get("school_id"),
            "event_type": "logout",
            "event_data": {}
        }).execute()
    except Exception:
        pass
    return {"message": "تم تسجيل الخروج بنجاح"}
