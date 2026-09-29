# نماذج البيانات - Morix Platform
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Any
from datetime import datetime
from app.config import settings


class LoginRequest(BaseModel):
    email: str = Field(..., max_length=254)   # RFC 5321 حد الإيميل
    password: str = Field(..., min_length=1, max_length=128)

    @classmethod
    def validate_email_domain(cls, v):
        if not v.lower().endswith(f"@{settings.allowed_email_domain}"):
            raise ValueError(f"الإيميل لازم يكون @{settings.allowed_email_domain}")
        return v.lower()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=6, max_length=128)


class SchoolSetupRequest(BaseModel):
    school_id: str
    students: List[dict]
    teachers: List[dict]
    admins_count: int = 1


class GeneratedAccount(BaseModel):
    full_name: str
    email: str
    password: str
    role: str
    grade: Optional[str] = None
    subject: Optional[str] = None
    ministry_id: Optional[str] = None


class AccountsResponse(BaseModel):
    accounts: List[GeneratedAccount]
    total: int
    school_name: str


class DiagnosticAnswer(BaseModel):
    question_id: int
    answer: str


class DiagnosticSubmit(BaseModel):
    answers: List[DiagnosticAnswer]


class DiagnosticResult(BaseModel):
    learning_style: str
    visual_score: int
    auditory_score: int
    kinesthetic_score: int
    description: str


class ChatMessage(BaseModel):
    conversation_id: Optional[str] = None
    message: str = Field(..., min_length=1, max_length=8000)   # حد منطقي للرسالة
    book_id: Optional[str] = None
    image_base64: Optional[str] = Field(None, max_length=2_000_000)  # ~1.5MB صورة
    file_text: Optional[str] = Field(None, max_length=80_000)        # 80K حرف نص ملف
    language: Optional[str] = Field(None, max_length=10)             # لغة المستخدم (ar, en, es, fr, de, zh)


class ChatResponse(BaseModel):
    conversation_id: str
    reply: str
    from_cache: bool = False


class ConversationSummary(BaseModel):
    id: str
    title: str
    created_at: datetime
    book_title: Optional[str] = None


class BookCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    subject: str = Field(..., min_length=1, max_length=100)
    grade: str = Field(..., min_length=1, max_length=50)
    raw_text: Optional[str] = Field(None, max_length=500_000)  # نص الكتاب حتى 500K حرف
    key_concepts: Optional[List[str]] = []


class BookResponse(BaseModel):
    id: str
    title: str
    subject: str
    grade: str
    summary: Optional[str]
    key_concepts: List[Any] = []
    is_active: bool


class StatsResponse(BaseModel):
    total_users: int
    total_students: int
    total_teachers: int
    total_admins: int
    total_conversations: int
    learning_styles: dict
    recent_logins: int


class UserSettingsUpdate(BaseModel):
    theme: Optional[str] = Field(None, max_length=30)
    notifications_enabled: Optional[bool] = None
    difficulty: Optional[str] = Field(None, max_length=20)
    hobbies: Optional[List[str]] = None
    language: Optional[str] = Field(None, max_length=10)
    avatar_url: Optional[str] = Field(None, max_length=500_000)  # base64 صورة مضغوطة


class ComplaintCreate(BaseModel):
    type: str = Field("complaint", max_length=30)
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1, max_length=3000)


class ImageGenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=500)


class GameGenerateRequest(BaseModel):
    game_type: str
    subject: str
    topic: Optional[str] = ""
