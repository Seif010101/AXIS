# Vercel Serverless Entry Point - Morix Backend
import sys
import os

# نضيف مجلد backend للـ path علشان الـ imports تشتغل
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "backend")
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

# نستورد التطبيق نفسه من backend/main.py
from main import app  # noqa: E402

# Vercel expects a variable named `app` or a handler function
# FastAPI app is ASGI-compatible — Vercel Python runtime supports ASGI directly
