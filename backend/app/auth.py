# منطق المصادقة - JWT + bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
import bcrypt as _bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings
from app.database import get_db
import logging

logger = logging.getLogger(__name__)
security = HTTPBearer()


def validate_memorix_email(email: str) -> bool:
    """التحقق أن الإيميل ينتهي بـ @morix.tech"""
    return email.lower().endswith(f"@{settings.allowed_email_domain}")


def hash_password(password: str) -> str:
    """تشفير كلمة المرور باستخدام bcrypt"""
    return _bcrypt.hashpw(password.encode("utf-8"), _bcrypt.gensalt(rounds=10)).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """التحقق من كلمة المرور"""
    try:
        return _bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """إنشاء JWT token"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.jwt_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    """فك تشفير JWT token"""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm]
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="رمز الوصول غير صالح أو منتهي الصلاحية"
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_db)
) -> dict:
    """الحصول على المستخدم الحالي من التوكن"""
    token = credentials.credentials
    payload = decode_token(token)
    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="رمز الوصول غير صالح"
        )

    result = db.table("users").select("*").eq("id", user_id).eq("is_active", True).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="المستخدم غير موجود أو معطل"
        )

    return result.data[0]


async def require_role(*roles: str):
    """Dependency للتحقق من الدور"""
    async def _check(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"هذه الصفحة مخصصة لـ {', '.join(roles)} فقط"
            )
        return current_user
    return _check
