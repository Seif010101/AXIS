# خدمة تلخيص الكتب - Gemini
import logging
from typing import Optional
from app.config import settings
from app.services.cache_service import get_cached, set_cached, make_cache_key, SUMMARY_TTL_HOURS

logger = logging.getLogger(__name__)


async def summarize_book(title: str, subject: str, raw_text: str) -> Optional[str]:
    """توليد ملخص كتاب مدرسي باستخدام Gemini"""

    cache_key = make_cache_key("book_summary", title, subject, raw_text[:200])
    cached = await get_cached(cache_key)
    if cached:
        return cached.get("summary")

    if not settings.gemini_api_key or settings.gemini_api_key == "YOUR_GEMINI_API_KEY":
        return f"[ملخص تجريبي] كتاب {title} - مادة {subject}."

    try:
        from google import genai
        from google.genai import types
        from app.services.ai_service import _call_with_retry

        client = genai.Client(api_key=settings.gemini_api_key)

        # نأخذ أفضل 8000 حرف من النص لتغطية المحتوى الأساسي
        sample = raw_text[:8000]

        prompt = (
            f"أنت خبير تربوي متخصص. لخّص محتوى هذا الكتاب المدرسي تلخيصاً دقيقاً ومفيداً للطلاب والمعلمين.\n\n"
            f"عنوان الكتاب: {title}\nالمادة: {subject}\n\n"
            f"محتوى الكتاب:\n{sample}\n\n"
            f"اكتب ملخصاً شاملاً يتضمن:\n"
            f"1. الموضوعات الرئيسية والفصول الأساسية\n"
            f"2. المفاهيم والمصطلحات العلمية الأساسية\n"
            f"3. الأهداف التعليمية لكل موضوع\n"
            f"4. أمثلة وتطبيقات عملية مذكورة في الكتاب\n"
            f"باللغة العربية، منظم بنقاط واضحة، لا يتجاوز 600 كلمة."
        )

        config = types.GenerateContentConfig(temperature=0.3, max_output_tokens=1500)

        summary = None
        for model_name in ("models/gemini-2.0-flash-lite", "models/gemini-2.0-flash", "models/gemini-2.5-flash"):
            try:
                response = await _call_with_retry(
                    client.models.generate_content,
                    model=model_name, contents=prompt, config=config,
                    max_retries=2
                )
                summary = response.text
                if summary:
                    break
            except Exception as model_err:
                logger.warning(f"Summarizer model {model_name} failed: {model_err}")
                continue

        if not summary:
            raise RuntimeError("All summarizer models failed")

        await set_cached(cache_key, "book_summary", {"summary": summary}, SUMMARY_TTL_HOURS)
        return summary

    except Exception as e:
        logger.error(f"Book summarizer error: {e}")
        # fallback بسيط بدل None
        return f"📚 {title} — {subject}\n\n[تعذر توليد الملخص التلقائي. يمكن للمعلم إضافة ملخص يدوياً من قسم الكتب.]"
