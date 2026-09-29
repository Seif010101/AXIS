-- =============================================
-- Morix Platform v2 - Database Migration
-- شغّل هذا السكريبت في Supabase SQL Editor
-- =============================================

-- 1. إضافة أعمدة للمستخدمين
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stars_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0;

-- 2. تعديل CHECK constraint لإضافة دور owner
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('manager', 'admin', 'teacher', 'student', 'owner'));

-- 3. جدول إعدادات المستخدم
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    theme TEXT DEFAULT 'dark' CHECK (theme IN ('dark', 'light', 'library')),
    notifications_enabled BOOLEAN DEFAULT true,
    brightness INTEGER DEFAULT 100 CHECK (brightness BETWEEN 20 AND 100),
    difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    hobbies TEXT[] DEFAULT '{}',
    language TEXT DEFAULT 'ar' CHECK (language IN ('ar', 'en', 'de', 'fr', 'zh', 'es')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. جدول الـ Streaks
CREATE TABLE IF NOT EXISTS streaks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_login_date DATE,
    total_stars INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. جدول الواجبات
CREATE TABLE IF NOT EXISTS homework (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    teacher_id UUID REFERENCES users(id),
    school_id UUID REFERENCES schools(id),
    title TEXT NOT NULL,
    description TEXT,
    subject TEXT,
    grade TEXT,
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. جدول تسليم الواجبات
CREATE TABLE IF NOT EXISTS homework_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    homework_id UUID REFERENCES homework(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id),
    content TEXT,
    grade_score NUMERIC(5,2),
    feedback TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. جدول الاختبارات
CREATE TABLE IF NOT EXISTS tests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    teacher_id UUID REFERENCES users(id),
    school_id UUID REFERENCES schools(id),
    title TEXT NOT NULL,
    subject TEXT,
    grade TEXT,
    questions JSONB DEFAULT '[]',
    duration_minutes INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. جدول نتائج الاختبارات
CREATE TABLE IF NOT EXISTS test_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    test_id UUID REFERENCES tests(id),
    student_id UUID REFERENCES users(id),
    answers JSONB DEFAULT '{}',
    score NUMERIC(5,2),
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. جدول أوراق العمل
CREATE TABLE IF NOT EXISTS worksheets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    teacher_id UUID REFERENCES users(id),
    school_id UUID REFERENCES schools(id),
    title TEXT NOT NULL,
    subject TEXT,
    grade TEXT,
    content TEXT,
    ai_generated BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. جدول الألعاب التعليمية
CREATE TABLE IF NOT EXISTS educational_games (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES users(id),
    game_type TEXT CHECK (game_type IN ('mcq', 'matching', 'flashcards')),
    subject TEXT,
    content JSONB,
    score INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. جدول الشكاوى والاقتراحات
CREATE TABLE IF NOT EXISTS complaints (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    school_id UUID REFERENCES schools(id),
    type TEXT CHECK (type IN ('complaint', 'suggestion', 'bug')) DEFAULT 'complaint',
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
    response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. جدول الشارات
CREATE TABLE IF NOT EXISTS badges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    badge_type TEXT,
    badge_name TEXT,
    badge_description TEXT,
    badge_image_url TEXT,
    earned_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. إنشاء حساب المالك (كلمة المرور: admin123)
INSERT INTO users (email, password_hash, role, full_name, is_active, must_change_password)
VALUES (
    'owner@morix.tech',
    '$2b$10$1zMXdHwLtcmJwOPM7jdMtOXQdYC4lEdH2rfCg/t8DRub1khAcxUAm',
    'owner',
    'مالك المنصة',
    true,
    false
)
ON CONFLICT (email) DO NOTHING;

SELECT 'Morix v2 Migration Complete!' AS result;
