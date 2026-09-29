# توليد الحسابات تلقائياً
import random
import string
from typing import List
from app.config import settings
from app.auth import hash_password
import re


def generate_password(length: int = 10) -> str:
    """توليد كلمة مرور عشوائية"""
    chars = string.ascii_letters + string.digits
    return ''.join(random.choices(chars, k=length))


def normalize_arabic_name(name: str) -> str:
    """تحويل الاسم العربي لصيغة إيميل"""
    arabic_to_latin = {
        'أ': 'a', 'ا': 'a', 'إ': 'a', 'آ': 'a',
        'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j',
        'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh',
        'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
        'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z',
        'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
        'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
        'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a',
        'ة': 'a', 'ء': 'a', 'ئ': 'a', 'ؤ': 'w',
        ' ': '.', '-': '.', '_': '.'
    }
    result = ""
    for char in name:
        result += arabic_to_latin.get(char, char)
    # إزالة الأحرف غير المسموح بها في الإيميل
    result = re.sub(r'[^a-zA-Z0-9.]', '', result)
    result = re.sub(r'\.+', '.', result)
    result = result.strip('.')
    return result.lower() or "user"


def generate_student_email(name: str, ministry_id: str) -> str:
    """توليد إيميل الطالب: morix{رقم_وزاري}@morix.tech"""
    mid = re.sub(r'[^a-zA-Z0-9]', '', str(ministry_id)) or "000"
    return f"morix{mid}@{settings.allowed_email_domain}"


def generate_teacher_email(subject: str, index: int, ministry_id: str = "") -> str:
    """توليد إيميل المعلم: morix{رقم_وزاري}@morix.tech أو morix.teacher{رقم}@morix.tech"""
    if ministry_id:
        mid = re.sub(r'[^a-zA-Z0-9]', '', str(ministry_id))
        if mid:
            return f"morix{mid}@{settings.allowed_email_domain}"
    return f"morix.teacher{index}@{settings.allowed_email_domain}"


def generate_admin_email(index: int, ministry_id: str = "") -> str:
    """توليد إيميل الإداري: morix{رقم_وزاري}@morix.tech أو morix.admin{رقم}@morix.tech"""
    if ministry_id:
        mid = re.sub(r'[^a-zA-Z0-9]', '', str(ministry_id))
        if mid:
            return f"morix{mid}@{settings.allowed_email_domain}"
    return f"morix.admin{index}@{settings.allowed_email_domain}"


def _insert_user_safe(db, account_data: dict):
    """إدراج مستخدم مع تجاهل أعمدة غير موجودة (مثل section قبل تشغيل migration_v6).
    يرجع صف المستخدم المُنشأ (أو None)."""
    try:
        res = db.table("users").insert(account_data).execute()
        return res.data[0] if res.data else None
    except Exception:
        # احتمال إن عمود section لسه مش موجود — نحاول بدونه
        fallback = {k: v for k, v in account_data.items() if k != "section"}
        try:
            res = db.table("users").insert(fallback).execute()
            return res.data[0] if res.data else None
        except Exception:
            return None


def _name_of(person: dict) -> str:
    """يقبل name أو full_name (الإدخال اليدوي يستخدم name، والإكسيل يستخدم full_name)."""
    return (person.get("name") or person.get("full_name") or "").strip()


async def generate_accounts(
    school_id: str,
    students: List[dict],
    teachers: List[dict],
    admins_count: int,
    db,
    manager_id: str = None
) -> List[dict]:
    """توليد جميع الحسابات وحفظها في قاعدة البيانات"""
    all_accounts = []

    # ───────── توليد حسابات الطلبة ─────────
    for student in students:
        password = generate_password()
        name = _name_of(student)
        email = generate_student_email(name, student.get("ministry_id", "000"))

        # التحقق من عدم تكرار الإيميل
        existing = db.table("users").select("id").eq("email", email).execute()
        if existing.data:
            suffix = random.randint(100, 999)
            email = email.replace("@", f"{suffix}@")

        account_data = {
            "email": email,
            "password_hash": hash_password(password),
            "role": "student",
            "full_name": name,
            "ministry_id": student.get("ministry_id", ""),
            "grade": student.get("grade", ""),
            "section": student.get("section", ""),
            "school_id": school_id,
            "is_active": True,
            "must_change_password": True,
        }

        _insert_user_safe(db, account_data)
        all_accounts.append({
            "full_name": name,
            "email": email,
            "password": password,
            "role": "student",
            "grade": student.get("grade", ""),
            "section": student.get("section", ""),
            "ministry_id": student.get("ministry_id", ""),
        })

    # ───────── توليد حسابات المعلمين + تكليفاتهم ─────────
    # كل عنصر في teachers = تكليف واحد (مادة + صف + شعبة).
    # نجمّع التكليفات حسب المعلم (الرقم الوزاري أو الاسم) فنُنشئ حساباً واحداً + عدة تكليفات.
    teacher_groups = {}   # key -> {"name", "ministry_id", "subjects": set, "assignments": [..]}
    teacher_order = []
    for teacher in teachers:
        name = _name_of(teacher)
        if not name:
            continue
        mid = str(teacher.get("ministry_id", "")).strip()
        key = mid if mid else f"name::{name}"
        if key not in teacher_groups:
            teacher_groups[key] = {"name": name, "ministry_id": mid, "subjects": [], "assignments": []}
            teacher_order.append(key)
        grp = teacher_groups[key]
        subject = (teacher.get("subject") or "").strip()
        grade = (teacher.get("grade") or "").strip()
        section = (teacher.get("section") or "").strip()
        if subject and subject not in grp["subjects"]:
            grp["subjects"].append(subject)
        # نسجّل التكليف فقط لو فيه صف
        if grade:
            grp["assignments"].append({"grade": grade, "section": section, "subject": subject})

    for i, key in enumerate(teacher_order, start=1):
        grp = teacher_groups[key]
        password = generate_password()
        primary_subject = grp["subjects"][0] if grp["subjects"] else ""
        email = generate_teacher_email(primary_subject, i, grp["ministry_id"])

        existing = db.table("users").select("id").eq("email", email).execute()
        if existing.data:
            suffix = random.randint(100, 999)
            email = email.replace("@", f"{suffix}@")

        account_data = {
            "email": email,
            "password_hash": hash_password(password),
            "role": "teacher",
            "full_name": grp["name"],
            "ministry_id": grp["ministry_id"],
            "subject": primary_subject,
            "school_id": school_id,
            "is_active": True,
            "must_change_password": True,
        }

        new_user = _insert_user_safe(db, account_data)
        teacher_id = new_user.get("id") if new_user else None

        # إنشاء تكليفات المعلم (صف + شعبة + مادة) — دفاعياً لو الجدول لسه مش موجود
        if teacher_id and grp["assignments"]:
            for a in grp["assignments"]:
                try:
                    db.table("teacher_assignments").insert({
                        "teacher_id": teacher_id,
                        "school_id": school_id,
                        "grade": a["grade"],
                        "section": a.get("section", ""),
                        "subject": a.get("subject", "") or primary_subject,
                    }).execute()
                except Exception:
                    pass  # الجدول غير موجود بعد (migration_v6 لم يُشغّل) — نتجاهل

        all_accounts.append({
            "full_name": grp["name"],
            "email": email,
            "password": password,
            "role": "teacher",
            "subject": primary_subject,
            "classes": [
                f"{a['grade']}" + (f"/{a['section']}" if a.get("section") else "")
                for a in grp["assignments"]
            ],
        })

    # توليد حسابات الإداريين
    # نجيب أعلى رقم إداري موجود
    existing_admins = db.table("users") \
        .select("email") \
        .eq("school_id", school_id) \
        .eq("role", "admin") \
        .execute()
    start_index = len(existing_admins.data) + 1 if existing_admins.data else 1

    for i in range(start_index, start_index + admins_count):
        password = generate_password()
        email = generate_admin_email(i)

        existing = db.table("users").select("id").eq("email", email).execute()
        if existing.data:
            email = generate_admin_email(i + 100)

        account_data = {
            "email": email,
            "password_hash": hash_password(password),
            "role": "admin",
            "full_name": f"إداري {i}",
            "school_id": school_id,
            "is_active": True,
            "must_change_password": True,
        }

        db.table("users").insert(account_data).execute()
        all_accounts.append({
            "full_name": f"إداري {i}",
            "email": email,
            "password": password,
            "role": "admin",
        })

    return all_accounts
