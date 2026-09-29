# خدمة الذكاء الاصطناعي - Gemini - Morix Platform
import logging
import json
import base64
import asyncio
from typing import Optional
from app.config import settings
from app.services.cache_service import get_cached, set_cached, make_cache_key, CHAT_TTL_HOURS

logger = logging.getLogger(__name__)

# ── Retry helper ──────────────────────────────────────────────────────────────
_RATE_LIMIT_SIGNALS = ("RESOURCE_EXHAUSTED", "429", "quota", "rate limit", "too many requests")

def _is_rate_limit(err: Exception) -> bool:
    s = str(err).lower()
    return any(sig.lower() in s for sig in _RATE_LIMIT_SIGNALS)

async def _call_with_retry(fn, *args, max_retries: int = 3, **kwargs):
    """
    Calls an async or sync callable with exponential backoff on 429 / rate-limit errors.
    Delays: 2s → 5s → 12s (roughly 2^n * 1.5)
    """
    delays = [2, 5, 12]
    last_err = None
    for attempt in range(max_retries + 1):
        try:
            result = fn(*args, **kwargs)
            # support both coroutines and sync callables
            if asyncio.iscoroutine(result):
                return await result
            return result
        except Exception as e:
            last_err = e
            if _is_rate_limit(e) and attempt < max_retries:
                wait = delays[min(attempt, len(delays) - 1)]
                logger.warning(f"Rate-limit hit (attempt {attempt+1}/{max_retries}), retrying in {wait}s…")
                await asyncio.sleep(wait)
                continue
            raise
    raise last_err

LEARNING_STYLE_PROMPTS = {
    "visual": "Visual learner: use bullet points, tables, numbered lists, and clear visual organization.",
    "auditory": "Auditory learner: use storytelling, verbal repetition, and spoken-style examples.",
    "kinesthetic": "Kinesthetic learner: use real-life examples, practical steps, and hands-on activities.",
}


def _extract_first_name(full_name: str) -> str:
    if not full_name:
        return "Student"
    import re
    name = re.sub(r'[\d._-]', ' ', full_name).strip()
    parts = name.split()
    return parts[0] if parts else full_name


LANG_NAMES = {
    "ar": "Arabic (العربية)",
    "en": "English",
    "es": "Spanish (Español)",
    "fr": "French (Français)",
    "de": "German (Deutsch)",
    "zh": "Chinese (中文)",
}


def _build_system_prompt(
    full_name: str,
    learning_style: Optional[str],
    book_summary: Optional[str],
    role: str = "student",
    difficulty: str = "medium",
    preferred_lang: Optional[str] = None,
) -> str:
    first_name = _extract_first_name(full_name)

    # ── بناء تعليمات اللغة ────────────────────────────────────────────────
    if preferred_lang and preferred_lang != "ar":
        lang_display = LANG_NAMES.get(preferred_lang, preferred_lang)
        lang_rule = (
            f"## ══ MANDATORY LANGUAGE RULE ══\n"
            f"The user has set their preferred interface language to: **{lang_display}**.\n"
            f"You MUST respond ENTIRELY in {lang_display} — no exceptions.\n"
            f"Even if the user writes in Arabic or any other language, your reply must be in {lang_display}.\n"
            f"Only switch language if the user explicitly asks you to in their message.\n\n"
        )
    else:
        lang_rule = (
            f"## Language & Dialect Rule:\n"
            f"Detect the language AND dialect of the user's message and respond in the EXACT same way.\n"
            f"Gulf Arabic → Gulf Arabic | Egyptian → Egyptian | Levantine → Levantine | "
            f"Formal Arabic → Formal Arabic | English → English | any language → same language.\n"
            f"NEVER switch language unless the user switches first.\n\n"
        )

    file_handling_rule = (
        "\n\n## CRITICAL RULE ABOUT FILES:\n"
        "If the user asks you to analyze, summarize, or read a file, DO NOT apologize and DO NOT say you cannot read files. "
        "The system has already extracted the file content and provided it to you as text in the user's message. "
        "Just read the provided text and fulfill the user's request directly."
    )

    if role == "teacher":
        return (
            f"You are an intelligent teaching assistant for Morix educational platform.\n"
            f"Teacher name: {first_name}\n\n"
            f"## Your Role:\n"
            f"Help the teacher prepare educational materials, explain concepts, design activities, "
            f"create test questions, worksheets, and lesson plans.\n\n"
            f"## Accuracy & Honesty Rules:\n"
            f"- Only provide facts you are 100% certain about.\n"
            f"- If a question is outside your knowledge, say so clearly instead of guessing.\n"
            f"- For curriculum-specific content, rely on what the teacher provides — don't invent syllabus details.\n"
            f"- Mark any uncertain information with: '(يُنصح بالتحقق من المصدر الرسمي)'\n\n"
            f"{lang_rule}"
            f"## Guidelines:\n"
            f"- Be precise, educational, and professional.\n"
            f"- Suggest appropriate teaching strategies.\n"
            f"- Format output clearly with headings and bullet points.\n"
            f"- NEVER hallucinate exam questions, dates, or curriculum facts."
            f"{file_handling_rule}"
        )

    style = LEARNING_STYLE_PROMPTS.get(learning_style or "visual", LEARNING_STYLE_PROMPTS["visual"])

    difficulty_instruction = {
        "easy": "Use very simple language, short sentences, and basic examples.",
        "medium": "Use clear language with moderate detail and good examples.",
        "hard": "Use precise academic language with depth and challenging examples.",
    }.get(difficulty, "Use clear language with moderate detail.")

    # ── سياق الكتاب — المصدر الأساسي الأول ─────────────────────────────
    if book_summary:
        book_ctx = (
            f"\n\n## ══ PRIMARY KNOWLEDGE SOURCE (ALWAYS USE FIRST) ══\n"
            f"The following is the official curriculum book content for this session.\n"
            f"ALWAYS base your answers primarily on this content:\n\n"
            f"{book_summary}\n\n"
            f"## Knowledge Priority Rules:\n"
            f"1. FIRST: Check if the answer exists in the book context above.\n"
            f"2. If found → answer directly from the book, cite it clearly.\n"
            f"3. If NOT in book → you may supplement ONLY with facts you are 100% certain about.\n"
            f"4. NEVER invent, guess, or hallucinate facts not in the book.\n"
            f"5. If uncertain → say: 'هذا غير موجود في الكتاب، لكن من المعرفة العامة...'\n"
        )
    else:
        book_ctx = (
            "\n\n## Knowledge Rules:\n"
            "- Answer ONLY with facts you are 100% certain about.\n"
            "- If unsure → say 'لست متأكداً 100% من هذه المعلومة' clearly.\n"
            "- NEVER invent or hallucinate facts.\n"
        )

    return (
        f"You are an enthusiastic smart teacher on Morix educational platform.\n"
        f"Student name: {first_name}\n"
        f"Always address the student by first name only: \"{first_name}\"\n\n"
        f"## Learning Style:\n{style}\n\n"
        f"## Difficulty Level:\n{difficulty_instruction}\n"
        f"{book_ctx}\n\n"
        f"{lang_rule}"
        f"## What You Can Help With:\n"
        f"- **Explain** topics — always from the book first, then general knowledge.\n"
        f"- **Summarize** chapters — based on the book content provided.\n"
        f"- **Review** — quiz the student on book content, correct based on book.\n"
        f"- **Homework help** — guide step by step using curriculum content.\n"
        f"- **Study plans** — organize study sessions around book chapters.\n"
        f"- **Solve problems** — math, science, language exercises.\n\n"
        f"## Rules:\n"
        f"- Greet with the student's name only on the FIRST message.\n"
        f"- Be encouraging, positive, and friendly.\n"
        f"- For reviews: ask questions one by one, wait for answer, then correct and explain.\n"
        f"- For summaries: structure clearly with headings and bullet points.\n"
        f"- Adapt explanation style to the learning style above.\n"
        f"- NEVER make up curriculum content — if unsure, say so clearly."
        f"{file_handling_rule}"
    )


async def chat_with_gemini(
    message: str,
    learning_style: Optional[str],
    book_summary: Optional[str] = None,
    conversation_history: Optional[list] = None,
    full_name: str = "Student",
    role: str = "student",
    difficulty: str = "medium",
    image_base64: Optional[str] = None,
    file_text: Optional[str] = None,
    preferred_lang: Optional[str] = None,
) -> tuple[str, bool]:
    """إرسال رسالة لـ Gemini - يرجع (رد, من_كاش)"""

    first_name = _extract_first_name(full_name)

    cache_key = make_cache_key(
        "chat", role, learning_style or "none",
        book_summary[:100] if book_summary else "none",
        message[:200]
    )
    cached = await get_cached(cache_key)
    if cached:
        return cached.get("text", ""), True

    gemini_key = settings.gemini_api_key
    if not gemini_key or gemini_key in ("YOUR_GEMINI_API_KEY", ""):
        return (
            f"مرحباً {first_name}!\n\n"
            f"Morix AI يعمل في الوضع التجريبي. سيتم تفعيل الذكاء الاصطناعي الكامل قريباً."
        ), False

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=gemini_key)

        contents = []
        if conversation_history:
            for msg in conversation_history[-12:]:
                r = "user" if msg["role"] == "user" else "model"
                contents.append(types.Content(role=r, parts=[types.Part(text=msg["content"])]))
        # بناء رسالة المستخدم مع المرفقات
        user_parts = []
        if file_text:
            user_parts.append(types.Part(text=f"[Attached file content]:\n{file_text[:80000]}\n\n[User message]: {message}"))
        elif image_base64:
            try:
                img_bytes = base64.b64decode(image_base64)
                user_parts.append(types.Part(inline_data=types.Blob(mime_type="image/jpeg", data=img_bytes)))
                user_parts.append(types.Part(text=message or "ما الذي تراه في هذه الصورة؟ اشرح لي بالتفصيل."))
            except Exception:
                user_parts.append(types.Part(text=message))
        else:
            user_parts.append(types.Part(text=message))
        contents.append(types.Content(role="user", parts=user_parts))

        config = types.GenerateContentConfig(
            system_instruction=_build_system_prompt(full_name, learning_style, book_summary, role, difficulty, preferred_lang),
            temperature=0.7,
            max_output_tokens=1200,
        )

        reply = None
        for model_name in ("models/gemini-2.0-flash-lite", "models/gemini-2.0-flash", "models/gemini-2.5-flash"):
            try:
                response = await _call_with_retry(
                    client.models.generate_content,
                    model=model_name, contents=contents, config=config,
                    max_retries=2
                )
                reply = response.text
                break
            except Exception as model_err:
                logger.warning(f"Model {model_name} failed: {model_err}")
                continue

        if reply is None:
            raise RuntimeError("All models failed")

        await set_cached(cache_key, "chat", {"text": reply}, CHAT_TTL_HOURS)
        return reply, False

    except Exception as e:
        err_str = str(e)
        logger.error(f"Gemini error: {err_str}")

        if "leaked" in err_str.lower() or "reported as leaked" in err_str.lower():
            return (
                "🔑 مفتاح Gemini API الحالي تم إلغاؤه (مُسرَّب).\n\n"
                "**خطوات الحل للمسؤول:**\n"
                "1. روح https://aistudio.google.com/app/apikey\n"
                "2. أنشئ مفتاح جديد\n"
                "3. حدّث `GEMINI_API_KEY` في إعدادات Vercel/Render\n"
                "4. أعد النشر (Redeploy)\n\n"
                "بعدها AI شغال 100%."
            ), False
        if "API_KEY_INVALID" in err_str or "API key not valid" in err_str or "PERMISSION_DENIED" in err_str:
            return (
                "🔑 مفتاح Gemini API غير صالح.\n"
                "تواصل مع مدير المنصة لتحديث المفتاح من https://aistudio.google.com/app/apikey"
            ), False
        if "RESOURCE_EXHAUSTED" in err_str or "429" in err_str or "quota" in err_str.lower() or "rate limit" in err_str.lower():
            return (
                "⏳ تم استنفاد الحد المسموح من Gemini API مؤقتاً (حتى بعد إعادة المحاولة).\n\n"
                "**سيعود AI للعمل خلال دقيقة أو دقيقتين تلقائياً.**\n"
                "يمكنك:\n"
                "• الانتظار دقيقة ثم إعادة المحاولة\n"
                "• تفعيل Billing على حساب Google AI Studio لرفع الحد\n"
                "• تواصل مع مدير المنصة إذا استمرت المشكلة"
            ), False
        if "SAFETY" in err_str or "safety" in err_str:
            return "⚠️ الرد محظور لأسباب أمان. غيّر صياغة سؤالك.", False

        return f"⚠️ تعذر الاتصال بـ AI:\n{err_str[:200]}", False


async def generate_educational_image(prompt: str) -> dict:
    """توليد صورة تعليمية — يرجع dict {success, image, error}"""
    if not settings.gemini_api_key or settings.gemini_api_key in ("YOUR_GEMINI_API_KEY", ""):
        return {"success": False, "image": None, "error": "مفتاح Gemini غير مضبوط"}

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.gemini_api_key)
        last_err = None

        # أولاً: Gemini 2.0 Flash توليد الصور
        for model_name in ("gemini-2.5-flash-image-preview",
                            "gemini-2.0-flash-exp-image-generation"):
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=f"Generate an educational illustration for students: {prompt}. Clean, colorful, clear, professional.",
                    config=types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"])
                )
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'inline_data') and part.inline_data is not None:
                        img_data = part.inline_data.data
                        if isinstance(img_data, bytes):
                            return {"success": True, "image": base64.b64encode(img_data).decode('utf-8'), "error": None}
                        return {"success": True, "image": img_data, "error": None}
            except Exception as e1:
                last_err = str(e1)
                logger.warning(f"Image model {model_name} failed: {e1}")

        # تشخيص نوع الخطأ
        err_msg = last_err or "كل النماذج فشلت"
        friendly = "تعذر توليد الصورة"
        if last_err and ("leaked" in last_err.lower() or "PERMISSION_DENIED" in last_err):
            friendly = "🔑 مفتاح Gemini مُسرَّب أو غير صالح — أنشئ مفتاحاً جديداً من aistudio.google.com"
        elif last_err and ("billing" in last_err.lower() or "quota" in last_err.lower()):
            friendly = "💳 توليد الصور يحتاج تفعيل Billing على حساب Google AI Studio"
        elif last_err and "not found" in last_err.lower():
            friendly = "النموذج غير متاح في منطقتك. جرّب لاحقاً."

        return {"success": False, "image": None, "error": friendly, "details": err_msg[:200]}

    except Exception as e:
        logger.error(f"Image generation error: {e}")
        return {"success": False, "image": None, "error": f"خطأ تقني: {str(e)[:150]}"}


async def generate_game_content(game_type: str, subject: str, topic: str = "") -> Optional[dict]:
    """توليد محتوى لعبة تعليمية (MCQ / Matching / Flashcards)"""
    if not settings.gemini_api_key or settings.gemini_api_key in ("YOUR_GEMINI_API_KEY", ""):
        return _get_demo_game(game_type, subject)

    topic_part = f" about: {topic}" if topic else ""

    prompts = {
        "mcq": (
            f"Generate exactly 5 educational multiple-choice questions about: {subject}{topic_part}\n\n"
            f"STRICT RULES:\n"
            f"1. Each option MUST contain REAL, SPECIFIC subject-matter content — actual facts, terms, dates, names, formulas, etc.\n"
            f"2. NEVER write 'خيار أ', 'Option A', 'خيار 1', 'choice 1', or any generic placeholder.\n"
            f"3. All 4 options must be plausible but only ONE is correct.\n"
            f"4. Write in the same language as the subject name.\n"
            f"5. Return ONLY a raw JSON array — no markdown, no ```json, no extra text.\n\n"
            f"Format:\n"
            f'[{{"question":"What is ...?","options":{{"a":"Real answer 1","b":"Real answer 2","c":"Real answer 3","d":"Real answer 4"}},"answer":"a","explanation":"Because ..."}}]'
        ),
        "matching": (
            f"Create 6 matching pairs for {subject}{topic_part}.\n"
            f"Each pair has a term and its definition/description.\n"
            f"Return ONLY valid JSON:\n"
            f'[{{"term":"...","definition":"..."}}]'
        ),
        "flashcards": (
            f"Create 8 flashcards for {subject}{topic_part}.\n"
            f"Each flashcard has a question (front) and answer (back).\n"
            f"Return ONLY valid JSON:\n"
            f'[{{"question":"...","answer":"..."}}]'
        ),
    }

    if game_type not in prompts:
        return None

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.gemini_api_key)
        config = types.GenerateContentConfig(temperature=0.4, max_output_tokens=2000)

        text = None
        for model_name in ("models/gemini-2.0-flash-lite", "models/gemini-2.0-flash", "models/gemini-2.5-flash"):
            try:
                response = await _call_with_retry(
                    client.models.generate_content,
                    model=model_name, contents=prompts[game_type], config=config,
                    max_retries=2
                )
                text = response.text.strip()
                break
            except Exception as model_err:
                logger.warning(f"Game model {model_name} failed: {model_err}")
                continue

        if not text:
            return _get_demo_game(game_type, subject)

        # تنظيف الرد من markdown blocks
        if "```" in text:
            parts = text.split("```")
            for p in parts:
                p = p.strip()
                if p.startswith("json"):
                    p = p[4:].strip()
                if p.startswith("[") or p.startswith("{"):
                    text = p
                    break
        text = text.strip()
        # Extract JSON array if there's surrounding text
        if not text.startswith("["):
            start = text.find("[")
            end = text.rfind("]")
            if start != -1 and end != -1:
                text = text[start:end+1]

        data = json.loads(text)
        return {"type": game_type, "subject": subject, "items": data}

    except Exception as e:
        logger.error(f"Game generation error: {e}")
        return _get_demo_game(game_type, subject)


def _get_demo_game(game_type: str, subject: str) -> dict:
    """بيانات تجريبية للعبة"""
    if game_type == "mcq":
        return {"type": "mcq", "subject": subject, "items": [
            {"question": f"ما هو الموضوع الرئيسي في {subject}?",
             "options": {"a": "الخيار الأول", "b": "الخيار الثاني", "c": "الخيار الثالث", "d": "الخيار الرابع"},
             "answer": "a", "explanation": "هذا مثال تجريبي."}
        ]}
    elif game_type == "matching":
        return {"type": "matching", "subject": subject, "items": [
            {"term": "مصطلح 1", "definition": "تعريف المصطلح الأول"},
            {"term": "مصطلح 2", "definition": "تعريف المصطلح الثاني"},
        ]}
    else:
        return {"type": "flashcards", "subject": subject, "items": [
            {"question": f"سؤال عن {subject}?", "answer": "الإجابة هنا"}
        ]}


async def generate_ppt_outline(title: str, subject: str, content: str = "") -> Optional[str]:
    """توليد مخطط عرض PowerPoint من محتوى كتاب"""
    if not settings.gemini_api_key or settings.gemini_api_key in ("YOUR_GEMINI_API_KEY", ""):
        return None

    content_part = f"\n\nBook content (first 2000 chars):\n{content[:2000]}" if content else ""

    prompt = (
        f"Create a professional PowerPoint presentation outline for:\n"
        f"Title: {title}\nSubject: {subject}{content_part}\n\n"
        f"Generate 8-10 slides with title, 4-6 bullet points each, and speaker notes.\n"
        f"Return ONLY valid JSON:\n"
        f'[{{"slide":1,"title":"...","points":["...","..."],"notes":"..."}}]'
    )

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.gemini_api_key)
        config = types.GenerateContentConfig(temperature=0.5, max_output_tokens=3000)

        for model_name in ("models/gemini-2.0-flash-lite", "models/gemini-2.0-flash", "models/gemini-2.5-flash"):
            try:
                response = await _call_with_retry(
                    client.models.generate_content,
                    model=model_name, contents=prompt, config=config,
                    max_retries=2
                )
                text = response.text.strip()
                # Extract JSON array
                if "```" in text:
                    parts = text.split("```")
                    for p in parts:
                        p = p.strip()
                        if p.startswith("json"):
                            p = p[4:].strip()
                        if p.startswith("["):
                            text = p
                            break
                if not text.startswith("["):
                    start = text.find("[")
                    end = text.rfind("]")
                    if start != -1 and end != -1:
                        text = text[start:end+1]
                return text
            except Exception as model_err:
                logger.warning(f"PPT model {model_name} failed: {model_err}")
                continue

        return None

    except Exception as e:
        logger.error(f"PPT outline error: {e}")
        return None


async def generate_video_script(topic: str, subject: str, duration_seconds: int = 300) -> Optional[str]:
    """توليد سكريبت فيديو تعليمي - المدة بالثواني (30 - 600)"""
    if not settings.gemini_api_key or settings.gemini_api_key in ("YOUR_GEMINI_API_KEY", ""):
        return None

    # تقييد المدة بين 30 ثانية و 10 دقائق
    duration_seconds = max(30, min(600, duration_seconds))
    minutes = duration_seconds // 60
    secs = duration_seconds % 60
    if minutes > 0 and secs > 0:
        duration_str = f"{minutes} دقيقة و{secs} ثانية"
    elif minutes > 0:
        duration_str = f"{minutes} دقيقة" if minutes == 1 else f"{minutes} دقائق"
    else:
        duration_str = f"{secs} ثانية"

    # عدد الأقسام بناءً على المدة
    if duration_seconds <= 60:
        sections_hint = "قسم واحد رئيسي فقط، مقدمة قصيرة وخاتمة"
    elif duration_seconds <= 180:
        sections_hint = "مقدمة (15 ثانية)، 2-3 نقاط رئيسية، خاتمة"
    else:
        sections_hint = "مقدمة، 4-6 أقسام رئيسية مع timestamps، خاتمة"

    prompt = (
        f"Write a detailed educational video script for:\n"
        f"Topic: {topic}\nSubject: {subject}\nTotal Duration: {duration_str}\n\n"
        f"Structure: {sections_hint}\n"
        f"Format each section as: [TIMESTAMP] Scene description + Narration text\n"
        f"Make the pacing realistic — fit naturally within {duration_str}.\n"
        f"Write in the same language as the topic (Arabic if Arabic topic, English if English topic)."
    )

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.gemini_api_key)
        config = types.GenerateContentConfig(temperature=0.6, max_output_tokens=2500)

        for model_name in ("models/gemini-2.0-flash-lite", "models/gemini-2.0-flash", "models/gemini-2.5-flash"):
            try:
                response = await _call_with_retry(
                    client.models.generate_content,
                    model=model_name, contents=prompt, config=config,
                    max_retries=2
                )
                return response.text
            except Exception as model_err:
                logger.warning(f"Video script model {model_name} failed: {model_err}")
                continue

        return None

    except Exception as e:
        logger.error(f"Video script error: {e}")
        return None
