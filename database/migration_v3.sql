-- =============================================
-- Morix Platform v3 - Schools & Demo Accounts
-- شغّل هذا السكريبت في Supabase SQL Editor
-- =============================================

-- ============================================
-- 0. جدول حفظ بيانات الإعداد والباسووردات
--    (يُستخدم لحفظ كلمات المرور تلقائياً)
-- ============================================
CREATE TABLE IF NOT EXISTS school_setup (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE UNIQUE,
    students_data JSONB DEFAULT '[]',
    teachers_data JSONB DEFAULT '[]',
    admins_count INTEGER DEFAULT 0,
    total_accounts_generated INTEGER DEFAULT 0,
    passwords_data JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 1. إضافة المدارس الجديدة
-- ============================================
INSERT INTO schools (name, ministry_code, setup_completed)
VALUES
    ('الأهلية الخيرية بنين فرع 4', 'AK-B-4', false),
    ('الأهلية الخيرية بنين فرع الجزات', 'AK-B-JAZAT', false),
    ('الأهلية الخيرية بنات القادسية', 'AK-G-QADISIYA', false),
    ('مدرسة الأمل', 'AMAL-1', false)
ON CONFLICT (ministry_code) DO NOTHING;

-- ============================================
-- 2. حسابات تجريبية لكل دور
-- كلمات المرور مختلفة لكل دور:
--   owner:   admin123
--   manager: manager456
--   admin:   admin789
--   teacher: teacher321
--   student: student654
-- ============================================

-- تعديل قيود الإيميل إن وجدت
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_email_domain;

-- owner (موجود من migration_v2 - password: admin123)
-- نحدّث كلمة المرور إذا تغيرت
UPDATE users SET
    password_hash = '$2b$10$1zMXdHwLtcmJwOPM7jdMtOXQdYC4lEdH2rfCg/t8DRub1khAcxUAm'
WHERE email = 'owner@morix.tech' AND role = 'owner';

-- حساب مدير تجريبي (password: manager456)
INSERT INTO users (email, password_hash, role, full_name, is_active, must_change_password)
VALUES (
    'demo.manager@morix.tech',
    '$2b$10$Nw2kXjIYBKabWD2LH.WxIuqtUDR0ucGkDaNRzwNUQaeVZVXUNeHIC',
    'manager',
    'مدير تجريبي',
    true,
    false
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    is_active = true;

-- حساب مشرف إداري تجريبي (password: admin789)
INSERT INTO users (email, password_hash, role, full_name, is_active, must_change_password)
VALUES (
    'demo.admin@morix.tech',
    '$2b$10$6q5Lyc2jL0L3y3muJsA8ve5aUQD447woYJWh5EFDPmQhSBLogHSIq',
    'admin',
    'مشرف إداري تجريبي',
    true,
    false
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    is_active = true;

-- حساب معلم تجريبي (password: teacher321)
INSERT INTO users (email, password_hash, role, full_name, subject, is_active, must_change_password)
VALUES (
    'demo.teacher@morix.tech',
    '$2b$10$fHS/js.7Ocg8BAgr7VcbiOvZj4YFrHnRG8QrAVmaP5oA.MeKdZxHG',
    'teacher',
    'معلم تجريبي',
    'الرياضيات',
    true,
    false
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    is_active = true;

-- حساب طالب تجريبي (password: student654)
INSERT INTO users (email, password_hash, role, full_name, grade, is_active, must_change_password)
VALUES (
    'demo.student@morix.tech',
    '$2b$10$2SQqiCQil9k5zmOa3hx8NO4vdtcyF67YGnShNe6TEyqoiVICntb7u',
    'student',
    'طالب تجريبي',
    'الصف الأول',
    true,
    false
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    is_active = true;

SELECT 'Morix v3 Migration Complete! Schools + Demo Accounts created.' AS result;

-- ============================================
-- ملاحظة: كلمات مرور الحسابات التجريبية
-- ============================================
-- owner@morix.tech        → admin123
-- demo.manager@morix.tech → manager456
-- demo.admin@morix.tech   → admin789
-- demo.teacher@morix.tech → teacher321
-- demo.student@morix.tech → student654
-- ============================================
