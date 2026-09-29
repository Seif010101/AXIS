"""فحص شامل لكل ميزات المنصة"""
import requests, json, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE = "http://localhost:8094/api/v1"
PASS = 0; FAIL = 0; FAILED = []

def t(name, ok, info=""):
    global PASS, FAIL
    if ok:
        print(f"  PASS  {name}")
        PASS += 1
    else:
        print(f"  FAIL  {name}  -> {str(info)[:200]}")
        FAIL += 1
        FAILED.append(name)

def post(path, token=None, body=None):
    h = {"Content-Type": "application/json"}
    if token: h["Authorization"] = f"Bearer {token}"
    return requests.post(BASE + path, json=body or {}, headers=h, timeout=60)

def get(path, token=None):
    h = {}
    if token: h["Authorization"] = f"Bearer {token}"
    return requests.get(BASE + path, headers=h, timeout=60)

def put(path, token=None, body=None):
    h = {"Content-Type": "application/json"}
    if token: h["Authorization"] = f"Bearer {token}"
    return requests.put(BASE + path, json=body or {}, headers=h, timeout=60)

def delete(path, token=None):
    h = {}
    if token: h["Authorization"] = f"Bearer {token}"
    return requests.delete(BASE + path, headers=h, timeout=60)

print("\n=== AUTH ===")
accounts = {
    "owner":   ("owner@morix.tech", "admin123"),
    "manager": ("demo.manager@morix.tech", "manager456"),
    "admin":   ("demo.admin@morix.tech", "admin789"),
    "teacher": ("demo.teacher@morix.tech", "teacher321"),
    "student": ("demo.student@morix.tech", "student654"),
}
tokens = {}
for role, (email, pw) in accounts.items():
    try:
        r = post("/auth/login", body={"email": email, "password": pw})
        ok = r.status_code == 200 and "access_token" in r.text
        t(f"Login {role}", ok, r.text[:150] if not ok else "")
        if ok: tokens[role] = r.json()["access_token"]
    except Exception as e:
        t(f"Login {role}", False, str(e))

# Bad email rejection
try:
    r = post("/auth/login", body={"email": "x@gmail.com", "password": "x"})
    t("Reject non-morix.tech", r.status_code == 400, r.text[:150])
except Exception as e:
    t("Reject non-morix.tech", False, str(e))

print("\n=== SYSTEM CHECK ===")
try:
    r = get("/system-check", tokens.get("owner"))
    d = r.json()
    t("Supabase OK", d["checks"]["supabase"]["ok"], d["checks"]["supabase"])
    t("Gemini OK", d["checks"]["gemini"]["ok"], d["checks"]["gemini"])
    t("All env vars set", all(d["checks"]["env"].values()), d["checks"]["env"])
except Exception as e:
    t("System check", False, str(e))

print("\n=== AI ===")
try:
    r = post("/ai/chat", tokens["student"], {"message": "say hi in 5 words"})
    d = r.json()
    reply = d.get("reply", "")
    is_fallback = any(x in reply for x in ["مفتاح Gemini API الحالي", "All models failed", "تعذر الاتصال", "غير صالح"])
    t("AI chat returns valid reply", not is_fallback and len(reply) > 5, reply[:200])
except Exception as e:
    t("AI chat", False, str(e))

print("\n=== STUDENT FEATURES ===")
ST = tokens.get("student")
if ST:
    endpoints = [
        ("/student/profile", "name"),
        ("/student/progress", "total_stars"),
        ("/student/diagnostic/questions", "question"),
        ("/student/leaderboard", "[" ),
        ("/student/daily-challenge", "already_answered"),
        ("/student/homework", "["),
        ("/student/tests", "["),
        ("/student/worksheets", "["),
        ("/student/games", "["),
        ("/student/settings", "theme"),
        ("/student/tutor-personalities", "key"),
    ]
    for path, expected in endpoints:
        try:
            r = get(path, ST)
            t(f"GET {path}", expected in r.text or r.status_code == 200, f"{r.status_code} {r.text[:120]}")
        except Exception as e:
            t(f"GET {path}", False, str(e))

    # POST endpoints
    try:
        r = post("/student/mood", ST, {"mood": "focused"})
        t("POST mood", r.status_code == 200 and "suggestion" in r.text, r.text[:100])
    except Exception as e:
        t("POST mood", False, str(e))
    try:
        r = post("/student/focus-session", ST, {"duration_minutes": 25})
        t("POST focus-session", r.status_code == 200 and "stars_earned" in r.text, r.text[:100])
    except Exception as e:
        t("POST focus-session", False, str(e))
    try:
        r = put("/student/settings", ST, {"theme": "library", "language": "en", "brightness": 80, "difficulty": "hard"})
        t("PUT student settings", r.status_code == 200, r.text[:100])
    except Exception as e:
        t("PUT student settings", False, str(e))

print("\n=== TEACHER FEATURES ===")
TT = tokens.get("teacher")
if TT:
    for path, expected in [
        ("/teacher/homework", "["),
        ("/teacher/tests", "["),
        ("/teacher/worksheets", "["),
        ("/teacher/students", "["),
        ("/teacher/settings", "theme"),
        ("/teacher/prompt-library", "categories"),
        ("/teacher/research-digest", "digest"),
        ("/teacher/performance-insights", "total_students"),
    ]:
        try:
            r = get(path, TT)
            t(f"GET {path}", r.status_code == 200, f"{r.status_code}")
        except Exception as e:
            t(f"GET {path}", False, str(e))

    # AI-powered POST endpoints
    for path, body in [
        ("/teacher/lesson-plan", {"topic": "الجاذبية", "grade": "الصف الخامس", "duration_minutes": 45}),
        ("/teacher/multimedia-convert", {"text": "الجاذبية قوة تجذب الأجسام نحو بعضها", "mode": "bullets"}),
        ("/teacher/activity-designer", {"topic": "البيئة", "student_count": 25}),
        ("/teacher/compose-message", {"purpose": "إخطار بتأخر", "recipient": "ولي الأمر"}),
        ("/teacher/auto-feedback", {"student_name": "محمد", "strengths": "ممتاز في الرياضيات"}),
        ("/teacher/simplify-content", {"text": "النيوكليونات هي الجسيمات الموجودة في النواة الذرية", "level": "beginner"}),
        ("/teacher/differentiated-strategies", {"concept": "الكسور"}),
        ("/teacher/pedagogical-coach", {"challenge": "طالب كثير الكلام في الفصل"}),
        ("/teacher/chat", {"message": "اقترح طريقة تعليم الأرقام"}),
    ]:
        try:
            r = post(path, TT, body)
            d = r.json() if r.status_code == 200 else {}
            ok = r.status_code == 200 and len(json.dumps(d)) > 30
            t(f"POST {path}", ok, f"{r.status_code} keys={list(d.keys())[:4]}")
        except Exception as e:
            t(f"POST {path}", False, str(e))

    try:
        r = put("/teacher/settings", TT, {"theme": "light", "language": "de", "brightness": 90})
        t("PUT teacher settings", r.status_code == 200, r.text[:100])
    except Exception as e:
        t("PUT teacher settings", False, str(e))

print("\n=== ADMIN FEATURES ===")
AD = tokens.get("admin")
if AD:
    for path, expected in [
        ("/admin/overview", "students"),
        ("/admin/students", "["),
        ("/admin/settings", "theme"),
        ("/admin/school-pulse", "students"),
        ("/admin/announcements", "["),
    ]:
        try:
            r = get(path, AD)
            t(f"GET {path}", r.status_code == 200, f"{r.status_code}")
        except Exception as e:
            t(f"GET {path}", False, str(e))

    try:
        r = post("/admin/announcement", AD, {"title": "تست", "content": "محتوى تست"})
        t("POST announcement", r.status_code == 200, r.text[:100])
    except Exception as e:
        t("POST announcement", False, str(e))
    try:
        r = post("/admin/incident-report", AD, {"summary": "طالب تأخر عن الفصل"})
        t("POST incident-report (AI)", r.status_code == 200 and "report" in r.text, r.text[:120])
    except Exception as e:
        t("POST incident-report", False, str(e))
    try:
        r = put("/admin/settings", AD, {"theme": "dark", "language": "zh"})
        t("PUT admin settings", r.status_code == 200, r.text[:100])
    except Exception as e:
        t("PUT admin settings", False, str(e))

print("\n=== MANAGER FEATURES ===")
MG = tokens.get("manager")
if MG:
    for path in ["/manager/schools", "/manager/health-score", "/manager/stats", "/manager/books", "/manager/settings"]:
        try:
            r = get(path, MG)
            t(f"GET {path}", r.status_code == 200, f"{r.status_code}")
        except Exception as e:
            t(f"GET {path}", False, str(e))

    # Create + delete school
    try:
        r = post("/manager/schools", MG, {"name": "مدرسة فحص شامل", "branch": "فرع الاختبار"})
        ok = r.status_code == 200 and "id" in r.text
        t("POST create school", ok, r.text[:120])
        if ok:
            sid = r.json().get("id")
            r2 = delete(f"/manager/schools/{sid}", MG)
            t("DELETE school", r2.status_code == 200, r2.text[:100])
    except Exception as e:
        t("Create/Delete school", False, str(e))

    try:
        r = post("/manager/strategic-advisor", MG, {"question": "كيف أحسن أداء المدرسة؟"})
        t("POST strategic-advisor (AI)", r.status_code == 200 and "advice" in r.text, r.text[:120])
    except Exception as e:
        t("Strategic advisor", False, str(e))

    try:
        r = put("/manager/settings", MG, {"theme": "library", "language": "es", "brightness": 75})
        t("PUT manager settings", r.status_code == 200, r.text[:100])
    except Exception as e:
        t("PUT manager settings", False, str(e))

print("\n=== OWNER FEATURES ===")
OW = tokens.get("owner")
if OW:
    for path in ["/owner/stats", "/owner/platform-pulse", "/owner/ai-cost", "/owner/churn-risk",
                 "/owner/complaints", "/owner/users", "/owner/schools", "/owner/settings"]:
        try:
            r = get(path, OW)
            t(f"GET {path}", r.status_code == 200, f"{r.status_code}")
        except Exception as e:
            t(f"GET {path}", False, str(e))

    try:
        r = post("/owner/broadcast", OW, {"title": "تست", "content": "رسالة تست"})
        t("POST broadcast", r.status_code == 200, r.text[:100])
    except Exception as e:
        t("Broadcast", False, str(e))
    try:
        r = put("/owner/settings", OW, {"theme": "dark", "language": "fr"})
        t("PUT owner settings", r.status_code == 200, r.text[:100])
    except Exception as e:
        t("PUT owner settings", False, str(e))

print("\n=== AI GENERATIONS ===")
if ST:
    try:
        r = post("/ai/generate-image", ST, {"prompt": "خلية بسيطة"})
        d = r.json()
        # Image gen needs Imagen — may fail with billing not enabled, that's OK
        if d.get("success"):
            t("AI image generation", True, "image generated")
        else:
            print(f"  WARN  AI image gen — needs Imagen billing: {d.get('message','')[:120]}")
    except Exception as e:
        t("AI image gen", False, str(e))

if TT:
    try:
        r = post("/teacher/generate-ppt", TT, {"title": "الجاذبية", "subject": "فيزياء"})
        d = r.json()
        t("PPT generator", "outline" in d or "html" in d, list(d.keys())[:3])
    except Exception as e:
        t("PPT generator", False, str(e))

print("\n" + "="*40)
print(f"PASS: {PASS}    FAIL: {FAIL}    TOTAL: {PASS+FAIL}")
if FAILED:
    print(f"\nFailed tests:")
    for f in FAILED: print(f"  - {f}")
print("="*40)
