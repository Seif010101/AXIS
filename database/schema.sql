-- ============================================
-- Memorix - منصة التعلم الذكي
-- قاعدة البيانات - إصدار 1.0
-- ============================================

-- تفعيل UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. جدول المدارس
-- ============================================
CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    ministry_code VARCHAR(50) UNIQUE NOT NULL,
    setup_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. جدول المستخدمين
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    ministry_id VARCHAR(50),
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    grade VARCHAR(20),
    subject VARCHAR(100),
    learning_style VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    must_change_password BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- التحقق من الإيميل
    CONSTRAINT chk_email_domain CHECK (email LIKE '%@memorixedu.ai'),
    -- التحقق من الدور
    CONSTRAINT chk_role CHECK (role IN ('manager', 'admin', 'teacher', 'student')),
    -- التحقق من أسلوب التعلم
    CONSTRAINT chk_learning_style CHECK (learning_style IN ('visual', 'auditory', 'kinesthetic') OR learning_style IS NULL)
);

-- ============================================
-- 3. جدول إعداد المدرسة
-- ============================================
CREATE TABLE IF NOT EXISTS school_setup (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    students_data JSONB DEFAULT '[]',
    teachers_data JSONB DEFAULT '[]',
    admins_count INTEGER DEFAULT 0,
    total_accounts_generated INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. جدول كتب المنهج
-- ============================================
CREATE TABLE IF NOT EXISTS curriculum_books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    grade VARCHAR(20) NOT NULL,
    summary TEXT,
    key_concepts JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. جدول محادثات الذكاء الاصطناعي
-- ============================================
CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'محادثة جديدة',
    book_id UUID REFERENCES curriculum_books(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. جدول رسائل الذكاء الاصطناعي
-- ============================================
CREATE TABLE IF NOT EXISTS ai_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_message_role CHECK (role IN ('user', 'assistant'))
);

-- ============================================
-- 7. جدول الكاش
-- ============================================
CREATE TABLE IF NOT EXISTS content_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_key VARCHAR(512) UNIQUE NOT NULL,
    content_type VARCHAR(50) NOT NULL,
    content JSONB NOT NULL,
    hit_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. جدول الإحصائيات
-- ============================================
CREATE TABLE IF NOT EXISTS analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(id) ON DELETE SET NULL,
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_event_type CHECK (event_type IN ('ai_chat', 'diagnostic_completed', 'login', 'logout', 'book_viewed'))
);

-- ============================================
-- 9. جدول الجلسات
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(512) UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- الفهارس لتحسين الأداء
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_school_id ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_student_id ON ai_conversations(student_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_content_cache_key ON content_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_analytics_school_id ON analytics(school_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- ============================================
-- بيانات أولية - Seed Data
-- ============================================

-- 3 مدارس تجريبية
INSERT INTO schools (id, name, ministry_code, setup_completed) VALUES
    ('11111111-1111-1111-1111-111111111111', 'مدرسة الأمل الابتدائية', 'SCH-001', FALSE),
    ('22222222-2222-2222-2222-222222222222', 'مدرسة النور المتوسطة', 'SCH-002', FALSE),
    ('33333333-3333-3333-3333-333333333333', 'مدرسة المستقبل الثانوية', 'SCH-003', FALSE)
ON CONFLICT DO NOTHING;

-- حساب المدير التجريبي
-- باسوورد: admin123 - مشفر بـ bcrypt
INSERT INTO users (
    id, email, password_hash, role, full_name,
    school_id, is_active, must_change_password
) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'manager@memorixedu.ai',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewdBExqBbpDFASwC',
    'manager',
    'مدير النظام',
    '11111111-1111-1111-1111-111111111111',
    TRUE,
    FALSE
) ON CONFLICT DO NOTHING;

-- ============================================
-- دوال مساعدة
-- ============================================

-- دالة تحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- تطبيق الدالة على الجداول
CREATE OR REPLACE TRIGGER update_schools_updated_at
    BEFORE UPDATE ON schools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_school_setup_updated_at
    BEFORE UPDATE ON school_setup
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_curriculum_books_updated_at
    BEFORE UPDATE ON curriculum_books
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_ai_conversations_updated_at
    BEFORE UPDATE ON ai_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
