-- =============================================
-- Morix Platform v4 - Critical bug fixes
-- شغّل هذا السكريبت في Supabase SQL Editor
-- =============================================

-- ============================================
-- 1. إصلاح جدول analytics — فك القيد الضيق
-- ============================================
ALTER TABLE analytics DROP CONSTRAINT IF EXISTS chk_event_type;
-- ندع event_type مفتوحاً لأنواع جديدة (daily_challenge, mood_tracker, focus_session, reflection, lesson_plan, broadcast، إلخ)

-- ============================================
-- 2. إضافة عمود last_login في users
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);

-- ============================================
-- 3. إصلاح schools — ministry_code يكون اختياري
-- ============================================
ALTER TABLE schools DROP CONSTRAINT IF EXISTS schools_ministry_code_key;
ALTER TABLE schools ALTER COLUMN ministry_code DROP NOT NULL;
-- نضيف فهرس فريد جزئي للقيم غير الفارغة فقط
CREATE UNIQUE INDEX IF NOT EXISTS schools_ministry_code_unique
  ON schools(ministry_code) WHERE ministry_code IS NOT NULL AND ministry_code <> '';

-- ============================================
-- 4. إضافة branch لـ schools
-- ============================================
ALTER TABLE schools ADD COLUMN IF NOT EXISTS branch VARCHAR(255);

-- ============================================
-- 5. إضافة tutor_personality في user_settings
-- ============================================
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS tutor_personality TEXT DEFAULT 'friend';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ============================================
-- 6. إزالة constraint قديم على email لو موجود
-- ============================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_email_domain;
-- لا نضع قيد على الإيميل في DB (التحقق في الـ backend بـ ALLOWED_EMAIL_DOMAIN)

-- ============================================
-- 7. تأكيد إن users.role يقبل owner
-- ============================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_role;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('manager', 'admin', 'teacher', 'student', 'owner'));

-- ============================================
-- 8. أعمدة إضافية مفيدة لـ users لو ناقصة
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS stars_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ============================================
-- 9. إنشاء جداول الميزات الجديدة لو مش موجودة
-- ============================================
CREATE TABLE IF NOT EXISTS complaints (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    type TEXT DEFAULT 'complaint',
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. تأكيد جدول diagnostic_results
-- ============================================
CREATE TABLE IF NOT EXISTS diagnostic_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    learning_style TEXT CHECK (learning_style IN ('visual', 'auditory', 'kinesthetic')),
    visual_score INT DEFAULT 0,
    auditory_score INT DEFAULT 0,
    kinesthetic_score INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ✅ تم تنفيذ Migration v4
-- ============================================
SELECT 'Morix v4 migration completed successfully' AS status;
