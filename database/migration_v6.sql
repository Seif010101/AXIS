-- =============================================
-- Morix Platform v6 — عزل الصفوف والشُّعب (Multi-tenancy: School → Grade → Section)
-- شغّل هذا السكريبت في Supabase SQL Editor مرة واحدة
-- =============================================

-- ============================================
-- 1. إضافة "الشعبة" (section) للطلاب
--    كل طالب له صف (grade) + شعبة (section)
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS section VARCHAR(50);

-- ============================================
-- 2. إضافة "الشعبة" للمحتوى الذي ينشئه المعلم
--    حتى يصل المحتوى للشعبة الصحيحة فقط
-- ============================================
ALTER TABLE homework   ADD COLUMN IF NOT EXISTS section VARCHAR(50);
ALTER TABLE tests      ADD COLUMN IF NOT EXISTS section VARCHAR(50);
ALTER TABLE worksheets ADD COLUMN IF NOT EXISTS section VARCHAR(50);

-- ============================================
-- 3. جدول تكليفات المعلمين
--    كل صف فيه = (معلم) يدرّس (مادة) لـ (صف + شعبة) معيّنة
--    معلم واحد ممكن يكون له أكثر من تكليف (أكثر من شعبة/مادة)
-- ============================================
CREATE TABLE IF NOT EXISTS teacher_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id  UUID REFERENCES schools(id) ON DELETE CASCADE,
    grade      VARCHAR(50) NOT NULL,
    section    VARCHAR(50),
    subject    VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- منع تكرار نفس التكليف لنفس المعلم
CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_assignment
  ON teacher_assignments(teacher_id, grade, COALESCE(section, ''), COALESCE(subject, ''));

CREATE INDEX IF NOT EXISTS idx_ta_teacher ON teacher_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_ta_school  ON teacher_assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_ta_class   ON teacher_assignments(school_id, grade, section);

-- ============================================
-- 4. فهارس لتسريع الفلترة حسب (مدرسة + صف + شعبة)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_class      ON users(school_id, grade, section);
CREATE INDEX IF NOT EXISTS idx_homework_class   ON homework(school_id, grade, section);
CREATE INDEX IF NOT EXISTS idx_tests_class      ON tests(school_id, grade, section);
CREATE INDEX IF NOT EXISTS idx_worksheets_class ON worksheets(school_id, grade, section);

-- ============================================
-- ✅ تم تنفيذ Migration v6
-- ============================================
SELECT 'Morix v6 migration completed — sections & teacher assignments ready' AS status;
