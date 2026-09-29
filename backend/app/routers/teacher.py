# راوتر المعلم - Morix Platform
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from app.auth import get_current_user
from app.database import get_db
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/teacher", tags=["المعلم"])


def _require_teacher(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ("teacher", "manager", "admin", "owner"):
        raise HTTPException(status_code=403, detail="هذه الخدمة للمعلمين فقط")
    return current_user


def _get_assignments(db, teacher_id: str):
    """تكليفات المعلم (صف + شعبة + مادة). ترجع [] لو الجدول مش موجود بعد."""
    try:
        res = db.table("teacher_assignments").select("grade, section, subject") \
            .eq("teacher_id", teacher_id).execute()
        return res.data or []
    except Exception:
        return []


def _assignment_allows(assignments, grade, section) -> bool:
    """هل المعلم مكلّف بهذا (الصف + الشعبة)؟
    لو المعلم ملوش أي تكليفات (حسابات قديمة) نسمح — حتى لا نكسر التدفّق الحالي."""
    if not assignments:
        return True
    g = (grade or "").strip()
    s = (section or "").strip()
    for a in assignments:
        ag = (a.get("grade") or "").strip()
        as_ = (a.get("section") or "").strip()
        if ag == g and (as_ == s or as_ == "" or s == ""):
            return True
    return False


@router.get("/my-classes")
async def get_my_classes(current_user: dict = Depends(_require_teacher), db=Depends(get_db)):
    """الصفوف والشُّعب المكلّف بها المعلم — لملء القوائم المنسدلة عند إنشاء المحتوى."""
    return _get_assignments(db, current_user["id"])


# ============================================
# 📡 البث المباشر (Jitsi)
# ============================================
@router.post("/live/start")
async def start_live(body: dict, current_user: dict = Depends(_require_teacher), db=Depends(get_db)):
    """المعلم يبدأ حصة بث مباشر لصف/شعبة."""
    from app.services import live
    grade = (body.get("grade") or "").strip()
    section = (body.get("section") or "").strip()
    subject = (body.get("subject") or "").strip()
    if not _assignment_allows(_get_assignments(db, current_user["id"]), grade, section):
        raise HTTPException(status_code=403, detail="غير مسموح: أنت غير مكلّف بهذا الصف/الشعبة")
    return live.start(current_user["id"], current_user.get("full_name", "المعلم"), grade, section, subject)


@router.post("/live/end")
async def end_live(current_user: dict = Depends(_require_teacher)):
    from app.services import live
    live.end(host_id=current_user["id"])
    return {"message": "تم إنهاء البث"}


@router.get("/live/mine")
async def my_live(current_user: dict = Depends(_require_teacher)):
    from app.services import live
    return [s for s in live.list_all() if s.get("host_id") == current_user["id"]]


# ============================================
# الواجبات
# ============================================
@router.get("/homework")
async def get_teacher_homework(current_user: dict = Depends(_require_teacher), db=Depends(get_db)):
    result = db.table("homework").select("*") \
        .eq("teacher_id", current_user["id"]) \
        .order("created_at", desc=True).execute()
    return result.data


@router.post("/homework")
async def create_homework(body: dict, current_user: dict = Depends(_require_teacher), db=Depends(get_db)):
    title = body.get("title", "")
    description = body.get("description", "")
    subject = body.get("subject", current_user.get("subject", ""))
    grade = body.get("grade", "")
    topic = body.get("topic", "")

    # توليد بالذكاء الاصطناعي إذا طُلب أو إذا كان العنوان فارغاً مع وجود موضوع
    if body.get("ai_generate") or (topic and not title):
        from app.services.ai_service import chat_with_gemini
        msg = (
            f"Create a homework assignment for {subject} {'grade ' + grade if grade else ''} about: {topic or subject}.\n"
            f"Respond with ONLY:\nTITLE: [clear assignment title]\nINSTRUCTIONS: [detailed student instructions, 3-5 steps]"
        )
        reply, _ = await chat_with_gemini(message=msg, learning_style=None,
                                           full_name=current_user.get("full_name", "معلم"), role="teacher")
        lines = reply.strip().split("\n")
        for line in lines:
            if line.startswith("TITLE:"):
                title = line.replace("TITLE:", "").strip()
            elif line.startswith("INSTRUCTIONS:"):
                description = line.replace("INSTRUCTIONS:", "").strip()
        if not title:
            title = f"واجب {subject} — {topic or ''}"
        if not description:
            description = reply

    section = (body.get("section") or "").strip()
    # التحقق إن المعلم مكلّف بهذا الصف/الشعبة
    if not _assignment_allows(_get_assignments(db, current_user["id"]), grade, section):
        raise HTTPException(status_code=403, detail="غير مسموح: أنت غير مكلّف بهذا الصف/الشعبة")

    payload = {
        "teacher_id": current_user["id"],
        "school_id": current_user.get("school_id"),
        "title": title or f"واجب {subject}",
        "description": description,
        "subject": subject,
        "grade": grade,
        "section": section,
        "due_date": body.get("due_date"),
    }
    try:
        result = db.table("homework").insert(payload).execute()
    except Exception:
        # عمود section لسه مش موجود (migration_v6 لم يُشغّل) — نحاول بدونه
        payload.pop("section", None)
        result = db.table("homework").insert(payload).execute()
    return result.data[0] if result.data else {"message": "تم إنشاء الواجب"}


@router.delete("/homework/{homework_id}")
async def delete_homework(homework_id: str, current_user: dict = Depends(_require_teacher), db=Depends(get_db)):
    db.table("homework").delete().eq("id", homework_id).eq("teacher_id", current_user["id"]).execute()
    return {"message": "تم حذف الواجب"}


@router.get("/homework/{homework_id}/submissions")
async def get_submissions(homework_id: str, current_user: dict = Depends(_require_teacher), db=Depends(get_db)):
    # التحقق أن الواجب يخص هذا المعلم
    hw_check = db.table("homework").select("id").eq("id", homework_id).eq("teacher_id", current_user["id"]).execute()
    if not hw_check.data:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية لعرض هذا الواجب")
    result = db.table("homework_submissions") \
        .select("*, users!student_id(full_name, grade)") \
        .eq("homework_id", homework_id).execute()
    return result.data


# ============================================
# الاختبارات
# ============================================
@router.get("/tests")
async def get_teacher_tests(current_user: dict = Depends(_require_teacher), db=Depends(get_db)):
    result = db.table("tests").select("id, title, subject, grade, duration_minutes, is_active, created_at") \
        .eq("teacher_id", current_user["id"]) \
        .order("created_at", desc=True).execute()
    return result.data


@router.post("/tests")
async def create_test(body: dict, current_user: dict = Depends(_require_teacher), db=Depends(get_db)):
    questions = body.get("questions", [])

    # توليد بالذكاء الاصطناعي إذا طُلب
    if body.get("ai_generate") and body.get("subject"):
        from app.services.ai_service import generate_game_content
        content = await generate_game_content("mcq", body.get("subject", ""), body.get("topic", ""))
        if content and content.get("items"):
            questions = [
                {
                    "id": i + 1,
                    "question": item["question"],
                    "options": item["options"],
                    "answer": item["answer"],
                }
                for i, item in enumerate(content["items"])
            ]

    grade = body.get("grade", "")
    section = (body.get("section") or "").strip()
    if not _assignment_allows(_get_assignments(db, current_user["id"]), grade, section):
        raise HTTPException(status_code=403, detail="غير مسموح: أنت غير مكلّف بهذا الصف/الشعبة")

    payload = {
        "teacher_id": current_user["id"],
        "school_id": current_user.get("school_id"),
        "title": body.get("title", "اختبار جديد"),
        "subject": body.get("subject", current_user.get("subject", "")),
        "grade": grade,
        "section": section,
        "questions": questions,
        "duration_minutes": body.get("duration_minutes", 60),
        "is_active": True,
    }
    try:
        result = db.table("tests").insert(payload).execute()
    except Exception:
        payload.pop("section", None)
        result = db.table("tests").insert(payload).execute()
    return result.data[0] if result.data else {"message": "تم إنشاء الاختبار"}


@router.put("/tests/{test_id}")
async def update_test(test_id: str, body: dict, current_user: dict = Depends(_require_teacher), db=Depends(get_db)):
    allowed = {k: body[k] for k in ("title", "questions", "duration_minutes", "is_active", "grade") if k in body}
    db.table("tests").update(allowed).eq("id", test_id).eq("teacher_id", current_user["id"]).execute()
    return {"message": "تم تحديث الاختبار"}


@router.delete("/tests/{test_id}")
async def delete_test(test_id: str, current_user: dict = Depends(_require_teacher), db=Depends(get_db)):
    db.table("tests").delete().eq("id", test_id).eq("teacher_id", current_user["id"]).execute()
    return {"message": "تم حذف الاختبار"}


# ============================================
# أوراق العمل
# ============================================
@router.get("/worksheets")
async def get_teacher_worksheets(current_user: dict = Depends(_require_teacher), db=Depends(get_db)):
    result = db.table("worksheets").select("*") \
        .eq("teacher_id", current_user["id"]) \
        .order("created_at", desc=True).execute()
    return result.data


@router.post("/worksheets")
async def create_worksheet(body: dict, current_user: dict = Depends(_require_teacher), db=Depends(get_db)):
    content = body.get("content", "")
    ai_generated = False

    if body.get("ai_generate"):
        from app.services.ai_service import chat_with_gemini
        subject = body.get("subject", "")
        topic = body.get("topic", "")
        msg = f"أنشئ ورقة عمل تعليمية شاملة عن مادة {subject}{f' - موضوع: {topic}' if topic else ''}. تضمين: الأهداف، الأنشطة، الأسئلة، والتقييم."
        reply, _ = await chat_with_gemini(
            message=msg,
            learning_style=None,
            full_name=current_user.get("full_name", "معلم"),
            role="teacher"
        )
        content = reply
        ai_generated = True

    payload = {
        "teacher_id": current_user["id"],
        "school_id": current_user.get("school_id"),
        "title": body.get("title", "ورقة عمل"),
        "subject": body.get("subject", current_user.get("subject", "")),
        "grade": body.get("grade", ""),
        "section": (body.get("section") or "").strip(),
        "content": content,
        "ai_generated": ai_generated,
    }
    try:
        result = db.table("worksheets").insert(payload).execute()
    except Exception:
        payload.pop("section", None)
        result = db.table("worksheets").insert(payload).execute()
    return result.data[0] if result.data else {"message": "تم إنشاء ورقة العمل", "content": content}


@router.delete("/worksheets/{worksheet_id}")
async def delete_worksheet(worksheet_id: str, current_user: dict = Depends(_require_teacher), db=Depends(get_db)):
    db.table("worksheets").delete().eq("id", worksheet_id).eq("teacher_id", current_user["id"]).execute()
    return {"message": "تم حذف ورقة العمل"}


# ============================================
# الطلاب والتقدم
# ============================================
@router.get("/students")
async def get_students(current_user: dict = Depends(_require_teacher), db=Depends(get_db)):
    school_id = current_user.get("school_id")
    cols_with_section = "id, full_name, grade, section, learning_style, stars_count, streak_count, created_at"
    cols_no_section = "id, full_name, grade, learning_style, stars_count, streak_count, created_at"

    def _run(cols):
        q = db.table("users").select(cols).eq("role", "student")
        if school_id:
            q = q.eq("school_id", school_id)
        return q.order("full_name").execute().data or []

    try:
        students = _run(cols_with_section)
    except Exception:
        students = _run(cols_no_section)  # عمود section لسه مش موجود

    # فلترة حسب تكليفات المعلم (صف + شعبة). المدير/الإداري ملوش تكليفات => يشوف الكل.
    assignments = _get_assignments(db, current_user["id"])
    if assignments and current_user.get("role") == "teacher":
        allowed = {((a.get("grade") or "").strip(), (a.get("section") or "").strip()) for a in assignments}

        def _match(s):
            sg = (s.get("grade") or "").strip()
            ss = (s.get("section") or "").strip()
            return any(g == sg and (sec == "" or sec == ss) for (g, sec) in allowed)

        students = [s for s in students if _match(s)]
    return students


@router.get("/students/{student_id}/progress")
async def get_student_progress(student_id: str, current_user: dict = Depends(_require_teacher), db=Depends(get_db)):
    student = db.table("users").select("*").eq("id", student_id).execute()
    if not student.data:
        raise HTTPException(status_code=404, detail="الطالب غير موجود")
    # منع الوصول لطلاب مدارس أخرى
    teacher_school = current_user.get("school_id")
    if teacher_school and student.data[0].get("school_id") and student.data[0]["school_id"] != teacher_school:
        raise HTTPException(status_code=403, detail="لا يمكنك الوصول لبيانات هذا الطالب")

    streak = db.table("streaks").select("*").eq("user_id", student_id).execute()
    streak_data = streak.data[0] if streak.data else {}

    convs = db.table("ai_conversations").select("id", count="exact").eq("student_id", student_id).execute()
    test_res = db.table("test_results").select("score, completed_at").eq("student_id", student_id).execute()
    games = db.table("educational_games").select("score, completed, game_type") \
        .eq("student_id", student_id).eq("completed", True).execute()

    return {
        "student": {k: v for k, v in student.data[0].items() if k not in ("password_hash",)},
        "streak": streak_data,
        "total_conversations": len(convs.data or []),
        "test_results": test_res.data or [],
        "game_results": games.data or [],
    }


# ============================================
# توليد PPT وفيديو
# ============================================
@router.post("/generate-ppt")
async def generate_ppt(body: dict, current_user: dict = Depends(_require_teacher)):
    from app.services.ai_service import generate_ppt_outline

    title = body.get("title", "")
    subject = body.get("subject", "")
    content = body.get("content", "")

    if not title or not subject:
        raise HTTPException(status_code=400, detail="العنوان والمادة مطلوبان")

    result = await generate_ppt_outline(title, subject, content)
    if not result:
        # نرجع شرائح أساسية كـ fallback مع رسالة واضحة
        fallback_slides = [
            {"slide": 1, "title": title, "points": [f"مقدمة عن {subject}", "أهمية الموضوع"], "notes": ""},
            {"slide": 2, "title": "المفاهيم الأساسية", "points": ["مفهوم 1", "مفهوم 2", "مفهوم 3"], "notes": ""},
            {"slide": 3, "title": "أمثلة تطبيقية", "points": ["مثال من الحياة اليومية", "تطبيق عملي"], "notes": ""},
            {"slide": 4, "title": "الخلاصة", "points": ["النقاط الرئيسية", "ما تعلمناه"], "notes": ""},
        ]
        import json as _j
        fallback = _j.dumps(fallback_slides, ensure_ascii=False)
        html = _build_ppt_html(title, fallback)
        return {
            "outline": fallback,
            "html": html,
            "warning": "⚠️ تم استنفاد حصة Gemini API اليوم — هذه شرائح أساسية. حاول مرة أخرى بعد 24 ساعة أو فعّل Billing على المفتاح."
        }

    # توليد HTML قابل للعرض في iframe (مع أنيميشن وتنقل بين الشرائح)
    html = _build_ppt_html(title, result)
    return {"outline": result, "html": html}


def _build_ppt_html(title: str, outline) -> str:
    """تحويل مخطط العرض إلى HTML تفاعلي للـ iframe"""
    import json as _j
    slides = []
    if isinstance(outline, dict) and outline.get("slides"):
        slides = outline["slides"]
    elif isinstance(outline, list):
        slides = outline
    elif isinstance(outline, str):
        try:
            parsed = _j.loads(outline)
            slides = parsed.get("slides", []) if isinstance(parsed, dict) else parsed
        except Exception:
            slides = [{"title": title, "bullets": [outline]}]
    if not slides:
        slides = [{"title": title, "bullets": ["لا توجد شرائح"]}]
    safe = lambda s: (s or "").replace("<", "&lt;").replace(">", "&gt;")
    slides_html = ""
    for i, sl in enumerate(slides):
        bullets = sl.get("bullets") or sl.get("points") or []
        if isinstance(bullets, str):
            bullets = [bullets]
        bul = "".join(f"<li>{safe(str(b))}</li>" for b in bullets)
        slides_html += f"""
        <div class="slide" data-i="{i}">
            <div class="slide-num">{i+1} / {len(slides)}</div>
            <h1>{safe(sl.get('title', f'شريحة {i+1}'))}</h1>
            <ul>{bul}</ul>
        </div>"""
    return f"""<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>{safe(title)}</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:'Tajawal',Tahoma,sans-serif;background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;height:100vh;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center}}
.deck{{width:90%;max-width:900px;height:80vh;position:relative}}
.slide{{position:absolute;inset:0;background:linear-gradient(135deg,rgba(99,102,241,.15),rgba(236,72,153,.05));border:2px solid rgba(99,102,241,.4);border-radius:24px;padding:48px;display:none;flex-direction:column;backdrop-filter:blur(10px);box-shadow:0 20px 60px rgba(0,0,0,.5);animation:fadeIn .5s}}
.slide.active{{display:flex}}
.slide h1{{font-size:36px;color:#a5b4fc;margin-bottom:24px;border-bottom:3px solid #6366f1;padding-bottom:12px}}
.slide ul{{list-style:none;flex:1;overflow-y:auto}}
.slide li{{font-size:22px;margin:14px 0;padding:14px 20px;background:rgba(255,255,255,.06);border-radius:12px;border-right:4px solid #6366f1;line-height:1.7}}
.slide-num{{position:absolute;top:20px;left:24px;color:#94a3b8;font-size:14px;background:rgba(0,0,0,.3);padding:6px 14px;border-radius:20px}}
.controls{{margin-top:20px;display:flex;gap:12px;align-items:center}}
.btn{{background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;color:#fff;padding:12px 24px;border-radius:12px;font-size:16px;cursor:pointer;font-family:inherit;font-weight:bold;transition:transform .2s}}
.btn:hover{{transform:scale(1.05)}}
.btn:disabled{{opacity:.4;cursor:not-allowed;transform:none}}
.indicator{{color:#a5b4fc;font-size:18px;font-weight:bold;min-width:80px;text-align:center}}
@keyframes fadeIn{{from{{opacity:0;transform:translateX(40px)}}to{{opacity:1;transform:translateX(0)}}}}
</style></head><body>
<div class="deck">{slides_html}</div>
<div class="controls">
  <button class="btn" id="prev">⬅ السابق</button>
  <span class="indicator" id="ind">1 / {len(slides)}</span>
  <button class="btn" id="next">التالي ➡</button>
  <button class="btn" id="full">⛶ ملء الشاشة</button>
</div>
<script>
let idx=0;const slides=document.querySelectorAll('.slide');const ind=document.getElementById('ind');
function show(i){{slides.forEach(s=>s.classList.remove('active'));slides[i].classList.add('active');ind.textContent=(i+1)+' / '+slides.length;document.getElementById('prev').disabled=i===0;document.getElementById('next').disabled=i===slides.length-1}}
document.getElementById('prev').onclick=()=>{{if(idx>0){{idx--;show(idx)}}}};
document.getElementById('next').onclick=()=>{{if(idx<slides.length-1){{idx++;show(idx)}}}};
document.getElementById('full').onclick=()=>{{document.documentElement.requestFullscreen?.()}};
document.addEventListener('keydown',e=>{{if(e.key==='ArrowLeft'&&idx<slides.length-1){{idx++;show(idx)}}else if(e.key==='ArrowRight'&&idx>0){{idx--;show(idx)}}}});
show(0);
</script></body></html>"""


@router.post("/generate-video")
async def generate_video_script(body: dict, current_user: dict = Depends(_require_teacher)):
    from app.services.ai_service import generate_video_script

    topic = body.get("topic", "")
    subject = body.get("subject", "")
    duration = body.get("duration_seconds", body.get("duration_minutes", 5) * 60)
    duration = max(30, min(600, int(duration)))

    if not topic:
        raise HTTPException(status_code=400, detail="الموضوع مطلوب")

    result = await generate_video_script(topic, subject, duration)
    if not result:
        # Fallback عند استنفاد الـ quota
        minutes = duration // 60
        fallback = f"""# 🎬 سكربت فيديو: {topic}
المادة: {subject} | المدة: {minutes} دقيقة

## [00:00 - 00:30] المقدمة
- ترحيب بالمشاهدين
- طرح سؤال محفّز عن {topic}
- توضيح ما سيتعلمه المشاهد

## [00:30 - {(duration // 3) // 60:02d}:{(duration // 3) % 60:02d}] الفكرة الأساسية
- شرح المفهوم الأساسي لـ {topic}
- مثال بصري بسيط
- ربط بالحياة اليومية

## [{(duration // 3) // 60:02d}:{(duration // 3) % 60:02d} - {(2*duration // 3) // 60:02d}:{(2*duration // 3) % 60:02d}] التفاصيل والأمثلة
- 3 أمثلة تطبيقية على {topic}
- شرح خطوة بخطوة
- نصائح عملية

## [{(2*duration // 3) // 60:02d}:{(2*duration // 3) % 60:02d} - {duration // 60:02d}:{duration % 60:02d}] الخلاصة والتطبيق
- أهم 3 نقاط من الفيديو
- نشاط بسيط للمشاهد
- دعوة للتفاعل والاشتراك

⚠️ ملاحظة: تم استنفاد حصة Gemini API اليوم. هذا سكربت أساسي — حاول مرة أخرى بعد 24 ساعة للحصول على سكربت مفصل بـ AI."""
        return {"script": fallback, "warning": "تم استنفاد حصة Gemini API اليوم"}

    return {"script": result}


# ============================================
# الشات للمعلم
# ============================================
@router.post("/chat")
async def teacher_chat(body: dict, current_user: dict = Depends(_require_teacher)):
    from app.services.ai_service import chat_with_gemini

    message = body.get("message", "")
    image_base64 = body.get("image_base64")
    file_text = body.get("file_text")
    preferred_lang = body.get("language")  # اللغة المفضلة من الفرونت

    if not message and not image_base64 and not file_text:
        raise HTTPException(status_code=400, detail="الرسالة فارغة")

    reply, from_cache = await chat_with_gemini(
        message=message or "حلل هذا المحتوى للمعلم",
        learning_style=None,
        full_name=current_user.get("full_name", "معلم"),
        role="teacher",
        image_base64=image_base64,
        file_text=file_text,
        preferred_lang=preferred_lang,
    )
    return {"reply": reply, "from_cache": from_cache}


# ============================================
# الإعدادات
# ============================================
@router.get("/settings")
async def get_settings(current_user: dict = Depends(_require_teacher), db=Depends(get_db)):
    result = db.table("user_settings").select("*").eq("user_id", current_user["id"]).execute()
    settings = result.data[0] if result.data else {}
    return {
        "theme": settings.get("theme", "dark"),
        "language": settings.get("language", "ar"),
        "notifications_enabled": settings.get("notifications_enabled", True),
        "avatar_url": current_user.get("avatar_url", ""),
        "email": current_user.get("email", ""),
        "full_name": current_user.get("full_name", ""),
    }


@router.put("/settings")
async def update_settings(body: dict, current_user: dict = Depends(_require_teacher), db=Depends(get_db)):
    valid_langs = {"ar", "en", "de", "fr", "zh", "es"}
    valid_themes = {"dark", "light", "library", "neon"}

    theme = body.get("theme", "dark")
    if theme not in valid_themes: theme = "dark"
    lang = body.get("language", "ar")
    if lang not in valid_langs: lang = "ar"
    data = {
        "user_id": current_user["id"],
        "theme": theme,
        "language": lang,
        "notifications_enabled": bool(body.get("notifications_enabled", True)),
    }
    try:
        existing = db.table("user_settings").select("id").eq("user_id", current_user["id"]).execute()
        if existing.data:
            db.table("user_settings").update(data).eq("user_id", current_user["id"]).execute()
        else:
            db.table("user_settings").insert(data).execute()
    except Exception as e:
        logger.warning(f"Teacher settings save failed: {e} — trying minimal")
        try:
            db.table("user_settings").upsert({"user_id": current_user["id"], "theme": theme}).execute()
        except Exception:
            pass

    if body.get("avatar_url") is not None:
        try:
            db.table("users").update({"avatar_url": body["avatar_url"]}).eq("id", current_user["id"]).execute()
        except Exception as e:
            logger.warning(f"avatar update failed: {e}")

    return {"message": "✅ تم حفظ الإعدادات"}


# ============================================================
# 📄 استخراج نص من ملف (للـ Notebook)
# ============================================================
@router.post("/extract-file")
async def extract_file_text(
    file: UploadFile = File(...),
    current_user: dict = Depends(_require_teacher),
):
    """استخراج النص من ملف PDF أو TXT أو MD أو PPTX للمعلم"""
    filename = (file.filename or "").lower()
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="الملف أكبر من 50MB — اختر ملفاً أصغر")
    text = ""

    # ───── TXT / MD ─────
    if filename.endswith((".txt", ".md")):
        try:
            text = content.decode("utf-8", errors="replace")
        except Exception:
            text = content.decode("latin-1", errors="replace")

    # ───── PDF ─────
    elif filename.endswith(".pdf"):
        try:
            from pypdf import PdfReader
            import io as _io
            reader = PdfReader(_io.BytesIO(content))
            pages_text = []
            for page in reader.pages:
                t = page.extract_text() or ""
                pages_text.append(t)
            text = "\n".join(pages_text)
        except Exception as e:
            logger.warning(f"pypdf failed for teacher: {e}")
            text = content.decode("utf-8", errors="ignore")

    # ───── PPTX ─────
    elif filename.endswith(".pptx"):
        try:
            from pptx import Presentation
            import io as _io
            prs = Presentation(_io.BytesIO(content))
            slides_text = []
            for slide in prs.slides:
                slide_parts = []
                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text.strip():
                        slide_parts.append(shape.text.strip())
                if slide_parts:
                    slides_text.append(" | ".join(slide_parts))
            text = "\n".join(slides_text)
        except Exception as e:
            logger.warning(f"pptx extraction failed: {e}")
            text = ""

    # ───── DOCX ─────
    elif filename.endswith(".docx"):
        try:
            import zipfile, re as _re, io as _io
            with zipfile.ZipFile(_io.BytesIO(content)) as zf:
                with zf.open("word/document.xml") as doc_xml:
                    xml_content = doc_xml.read().decode("utf-8", errors="replace")
            text = _re.sub(r"<[^>]+>", " ", xml_content)
            text = _re.sub(r"\s+", " ", text).strip()
        except Exception as e:
            logger.warning(f"docx extraction failed: {e}")
            text = ""

    else:
        raise HTTPException(status_code=400, detail="صيغة غير مدعومة — استخدم PDF أو PPTX أو DOCX أو TXT أو MD")

    if not text.strip():
        raise HTTPException(status_code=422, detail="لم يُستخرج أي نص من الملف — تأكد أنه يحتوي على نص قابل للقراءة")

    text = text[:80000]
    return {"text": text, "chars": len(text), "filename": file.filename}


# ============================================================
# 🎓 ميزات المعلم الذكية الجديدة (11 ميزة)
# ============================================================
async def _ai_text(prompt: str, full_name: str = "Teacher") -> str:
    """مولد نص عام يستخدم Gemini مع fallback chain"""
    from app.services.ai_service import chat_with_gemini
    try:
        text, _ = await chat_with_gemini(
            message=prompt,
            learning_style=None,
            full_name=full_name,
            role="teacher",
            difficulty="medium",
        )
        return text or ""
    except Exception as e:
        logger.error(f"AI text gen failed: {e}")
        return ""


# 1️⃣ مولد خطط الدروس التكيفي
@router.post("/lesson-plan")
async def generate_lesson_plan(
    body: dict,
    current_user: dict = Depends(_require_teacher),
    db=Depends(get_db),
):
    topic = (body.get("topic") or "").strip()
    grade = body.get("grade", "")
    duration = body.get("duration_minutes", 45)
    objectives = body.get("objectives", "")
    if not topic:
        raise HTTPException(400, "أدخل موضوع الدرس")
    prompt = f"""أنشئ خطة درس متكاملة بالعربية باستخدام JSON فقط بدون أي شرح خارجي.
الموضوع: {topic}
المرحلة: {grade}
المدة: {duration} دقيقة
الأهداف المرجوة: {objectives or 'حدد الأهداف بنفسك'}

أرجع JSON بهذه البنية بالضبط:
{{
  "title": "عنوان الدرس",
  "objectives": ["هدف 1", "هدف 2", "هدف 3"],
  "warm_up": "نشاط تمهيدي 5 دقائق",
  "main_activities": [
    {{"name": "نشاط 1", "duration": 10, "description": "..."}},
    {{"name": "نشاط 2", "duration": 15, "description": "..."}}
  ],
  "assessment": "طريقة التقييم",
  "discussion_questions": ["سؤال 1", "سؤال 2", "سؤال 3"],
  "homework": "الواجب المنزلي",
  "materials": ["مادة 1", "مادة 2"]
}}"""
    text = await _ai_text(prompt, current_user.get("full_name", ""))
    import json, re
    try:
        m = re.search(r"\{[\s\S]*\}", text)
        plan = json.loads(m.group(0)) if m else {"raw": text}
    except Exception:
        plan = {"raw": text}
    try:
        db.table("analytics").insert({
            "student_id": current_user["id"],
            "school_id": current_user.get("school_id"),
            "event_type": "lesson_plan_generated",
            "event_data": {"topic": topic, "grade": grade},
        }).execute()
    except Exception:
        pass
    return {"plan": plan}


# 2️⃣ محول الوسائط المتعددة (نص → ملخص/شرائح/أسئلة/خريطة)
@router.post("/multimedia-convert")
async def multimedia_convert(
    body: dict,
    current_user: dict = Depends(_require_teacher),
):
    text = (body.get("text") or "").strip()
    mode = body.get("mode", "bullets")  # bullets | slides | quiz | mindmap
    if not text:
        raise HTTPException(400, "أدخل النص المراد تحويله")
    prompts = {
        "bullets": f"حول النص التالي إلى قائمة نقاط رئيسية مختصرة وواضحة بالعربية (8-12 نقطة):\n\n{text}\n\nأرجع النقاط فقط مع رمز • قبل كل نقطة.",
        "slides":  f"حول النص التالي إلى عرض تقديمي 6-8 شرائح. أرجع JSON فقط:\n{{\"slides\":[{{\"title\":\"...\",\"bullets\":[\"...\"]}}]}}\n\nالنص:\n{text}",
        "quiz":    f"حول النص إلى 5 أسئلة اختيار من متعدد. JSON فقط:\n{{\"questions\":[{{\"q\":\"...\",\"options\":[\"a\",\"b\",\"c\",\"d\"],\"correct\":0}}]}}\n\nالنص:\n{text}",
        "mindmap": f"حول النص إلى خريطة مفاهيم. JSON فقط:\n{{\"central\":\"الموضوع\",\"branches\":[{{\"label\":\"...\",\"sub\":[\"...\"]}}]}}\n\nالنص:\n{text}",
    }
    p = prompts.get(mode, prompts["bullets"])
    out = await _ai_text(p, current_user.get("full_name", ""))
    if mode in ("slides", "quiz", "mindmap"):
        import json, re
        try:
            m = re.search(r"\{[\s\S]*\}", out)
            return {"mode": mode, "data": json.loads(m.group(0)) if m else {"raw": out}}
        except Exception:
            return {"mode": mode, "data": {"raw": out}}
    return {"mode": mode, "data": out}


# 3️⃣ مساعد تصميم الأنشطة الصفية
@router.post("/activity-designer")
async def design_activity(
    body: dict,
    current_user: dict = Depends(_require_teacher),
):
    topic = (body.get("topic") or "").strip()
    student_count = body.get("student_count", 30)
    has_internet = body.get("has_internet", True)
    activity_type = body.get("activity_type", "أي")  # حركي / جماعي / فردي
    constraints = body.get("constraints", "")
    if not topic:
        raise HTTPException(400, "أدخل موضوع النشاط")
    prompt = f"""اقترح 3 أنشطة صفية مبتكرة لموضوع: {topic}
عدد الطلاب: {student_count}
متاح إنترنت: {'نعم' if has_internet else 'لا'}
نوع النشاط المفضل: {activity_type}
قيود إضافية: {constraints or 'لا يوجد'}

لكل نشاط أعطني JSON بالشكل:
{{"activities":[{{"name":"...","duration_minutes":N,"materials":["..."],"steps":["1...","2..."],"learning_outcomes":["..."]}}]}}
أرجع JSON فقط."""
    out = await _ai_text(prompt, current_user.get("full_name", ""))
    import json, re
    try:
        m = re.search(r"\{[\s\S]*\}", out)
        return json.loads(m.group(0)) if m else {"raw": out}
    except Exception:
        return {"raw": out}


# 4️⃣ مساعد صياغة الرسائل الاحترافي
@router.post("/compose-message")
async def compose_message(
    body: dict,
    current_user: dict = Depends(_require_teacher),
):
    purpose = (body.get("purpose") or "").strip()
    recipient = body.get("recipient", "ولي الأمر")  # ولي أمر / إدارة / زميل
    tone = body.get("tone", "ودودة")  # ودودة / رسمية / حازمة
    student_name = body.get("student_name", "")
    notes = body.get("notes", "")
    if not purpose:
        raise HTTPException(400, "اكتب الغرض من الرسالة")
    prompt = f"""اكتب رسالة احترافية بالعربية موجهة إلى: {recipient}
نبرة الرسالة: {tone}
الغرض: {purpose}
اسم الطالب (إن وُجد): {student_name}
ملاحظات إضافية: {notes}

اكتب الرسالة كاملة جاهزة للإرسال — تبدأ بـ "السلام عليكم" وتنتهي بختام مناسب."""
    out = await _ai_text(prompt, current_user.get("full_name", ""))
    return {"message": out}


# 5️⃣ أتمتة التغذية الراجعة
@router.post("/auto-feedback")
async def auto_feedback(
    body: dict,
    current_user: dict = Depends(_require_teacher),
):
    student_name = body.get("student_name", "الطالب")
    strengths = body.get("strengths", "")
    weaknesses = body.get("weaknesses", "")
    subject = body.get("subject", "")
    if not strengths and not weaknesses:
        raise HTTPException(400, "أدخل نقاط القوة أو الضعف")
    prompt = f"""اكتب تقرير تربوي احترافي وداعم للطالب {student_name} في مادة {subject}.
نقاط القوة (مدخلات سريعة): {strengths}
نقاط الضعف (مدخلات سريعة): {weaknesses}

التقرير يجب أن يكون:
- إيجابياً ومحفزاً
- يبدأ بنقاط القوة
- يقدم اقتراحات عملية للتحسين
- ينتهي بتشجيع شخصي
- 3-4 فقرات منظمة"""
    out = await _ai_text(prompt, current_user.get("full_name", ""))
    return {"report": out}


# 6️⃣ محلل بيانات أداء الطلاب
@router.get("/performance-insights")
async def performance_insights(
    current_user: dict = Depends(_require_teacher),
    db=Depends(get_db),
):
    insights = {"total_students": 0, "avg_score": 0, "weak_topics": [], "strong_topics": [], "alert": ""}
    try:
        school_id = current_user.get("school_id")
        students = db.table("users").select("id, full_name").eq("role", "student").eq(
            "school_id", school_id
        ).eq("is_active", True).execute()
        insights["total_students"] = len(students.data or [])
        scores = db.table("analytics").select("event_data").eq(
            "school_id", school_id
        ).eq("event_type", "test_completed").limit(200).execute()
        all_scores = []
        topic_scores = {}
        for s in (scores.data or []):
            d = s.get("event_data") or {}
            sc = d.get("score")
            tp = d.get("topic", "عام")
            if isinstance(sc, (int, float)):
                all_scores.append(sc)
                topic_scores.setdefault(tp, []).append(sc)
        if all_scores:
            insights["avg_score"] = round(sum(all_scores) / len(all_scores), 1)
        for tp, lst in topic_scores.items():
            avg = sum(lst) / len(lst)
            if avg < 60:
                insights["weak_topics"].append({"topic": tp, "avg": round(avg, 1)})
            elif avg >= 80:
                insights["strong_topics"].append({"topic": tp, "avg": round(avg, 1)})
        if insights["weak_topics"]:
            top = insights["weak_topics"][0]
            insights["alert"] = f"⚠️ {top['topic']} — متوسط {top['avg']}%. هل تعيد شرحه بأسلوب مختلف؟"
    except Exception as e:
        logger.error(f"Insights failed: {e}")
    return insights


# 7️⃣ مبسط المحتوى (3 مستويات)
@router.post("/simplify-content")
async def simplify_content(
    body: dict,
    current_user: dict = Depends(_require_teacher),
):
    text = (body.get("text") or "").strip()
    level = body.get("level", "beginner")  # beginner | intermediate | advanced
    if not text:
        raise HTTPException(400, "أدخل النص")
    level_desc = {
        "beginner": "بسيط جداً، كلمات سهلة، أمثلة من الحياة اليومية، مناسب لطفل 8 سنوات أو طالب صعوبات تعلم",
        "intermediate": "متوسط الصعوبة، مناسب لطالب متوسط",
        "advanced": "متقدم، مفصل، يحتوي مصطلحات علمية دقيقة",
    }.get(level, "متوسط")
    prompt = f"""أعد صياغة النص التالي بمستوى: {level_desc}.
حافظ على المعنى الأصلي لكن عدّل التعقيد اللغوي.

النص الأصلي:
{text}

أرجع النص المعاد صياغته فقط بدون مقدمة."""
    out = await _ai_text(prompt, current_user.get("full_name", ""))
    return {"simplified": out, "level": level}


# 8️⃣ مولد استراتيجيات التعلم المتمايز
@router.post("/differentiated-strategies")
async def differentiated_strategies(
    body: dict,
    current_user: dict = Depends(_require_teacher),
):
    concept = (body.get("concept") or "").strip()
    if not concept:
        raise HTTPException(400, "أدخل المفهوم")
    prompt = f"""لدينا مفهوم تعليمي: {concept}
اقترح 3 طرق لتدريسه تخدم الأنماط الثلاثة (بصري، سمعي، حركي).
JSON فقط:
{{
  "visual": {{"approach":"...","activity":"...","tools":["..."]}},
  "auditory": {{"approach":"...","activity":"...","tools":["..."]}},
  "kinesthetic": {{"approach":"...","activity":"...","tools":["..."]}}
}}"""
    out = await _ai_text(prompt, current_user.get("full_name", ""))
    import json, re
    try:
        m = re.search(r"\{[\s\S]*\}", out)
        return json.loads(m.group(0)) if m else {"raw": out}
    except Exception:
        return {"raw": out}


# 9️⃣ الموجه التربوي الذكي
@router.post("/pedagogical-coach")
async def pedagogical_coach(
    body: dict,
    current_user: dict = Depends(_require_teacher),
):
    challenge = (body.get("challenge") or "").strip()
    if not challenge:
        raise HTTPException(400, "اوصف التحدي")
    prompt = f"""أنت مدرب تربوي خبير عالمياً. معلم يواجه التحدي التالي ويطلب نصيحة:

"{challenge}"

قدم نصيحة عملية مستندة إلى استراتيجيات تربوية معتمدة (مثل CBT, PBIS, Bloom, Vygotsky).
الرد يجب أن يكون:
1. تحليل سريع للموقف
2. 3 استراتيجيات عملية مرقمة
3. تحذير من خطأ شائع
4. عبارة تشجيعية للمعلم"""
    out = await _ai_text(prompt, current_user.get("full_name", ""))
    return {"advice": out}


# 🔟 ملخصات الأبحاث التربوية
@router.get("/research-digest")
async def research_digest(
    current_user: dict = Depends(_require_teacher),
):
    subject = current_user.get("subject", "التعليم العام")
    prompt = f"""أنت محرر مجلة تربوية. لخص 3 اتجاهات بحثية حديثة (2024-2025) في مجال تدريس: {subject}.
JSON فقط:
{{
  "digest": [
    {{"title":"...", "summary":"3 جمل مكثفة", "actionable_tip":"نصيحة عملية للمعلم", "source_type":"بحث/مقال/تقرير"}}
  ]
}}"""
    out = await _ai_text(prompt, current_user.get("full_name", ""))
    import json, re
    try:
        m = re.search(r"\{[\s\S]*\}", out)
        return json.loads(m.group(0)) if m else {"digest": [], "raw": out}
    except Exception:
        return {"digest": [], "raw": out}


# 1️⃣1️⃣ مكتبة قوالب الـ Prompts
@router.get("/prompt-library")
async def prompt_library(current_user: dict = Depends(_require_teacher)):
    return {
        "categories": [
            {
                "name": "📚 خطط الدروس",
                "prompts": [
                    {"title": "خطة درس 45 دقيقة", "template": "أنشئ خطة درس عن [الموضوع] للصف [الصف] مدتها 45 دقيقة مع نشاط حركي."},
                    {"title": "درس مع تجربة عملية", "template": "صمم درساً عن [الموضوع] يتضمن تجربة آمنة للصف [الصف]."},
                ]
            },
            {
                "name": "📝 الاختبارات والأسئلة",
                "prompts": [
                    {"title": "أسئلة بلوم", "template": "اكتب 10 أسئلة عن [الموضوع] موزعة على مستويات بلوم الستة."},
                    {"title": "اختبار قصير", "template": "اختبار 5 أسئلة MCQ + سؤال مقالي عن [الموضوع]."},
                ]
            },
            {
                "name": "💬 التواصل",
                "prompts": [
                    {"title": "رسالة لولي أمر", "template": "اكتب رسالة ودودة لولي أمر الطالب [الاسم] عن [السبب]."},
                    {"title": "تقرير سلوك إيجابي", "template": "اكتب تقريراً قصيراً يثني على سلوك الطالب [الاسم] في [الموقف]."},
                ]
            },
            {
                "name": "🎯 الأنشطة",
                "prompts": [
                    {"title": "نشاط جماعي", "template": "صمم نشاطاً جماعياً عن [الموضوع] لـ [العدد] طالب في [المدة] دقيقة."},
                    {"title": "لعبة تعليمية", "template": "اخترع لعبة تعليمية لتعليم [المفهوم] للصف [الصف]."},
                ]
            },
            {
                "name": "🧠 التمايز والشمولية",
                "prompts": [
                    {"title": "تبسيط مفهوم", "template": "اشرح [المفهوم الصعب] بطريقة بسيطة جداً لطالب صعوبات تعلم."},
                    {"title": "تحدي للمتفوقين", "template": "صمم تحدياً إثرائياً عن [الموضوع] لطلاب المرحلة [الصف] المتفوقين."},
                ]
            },
        ]
    }
