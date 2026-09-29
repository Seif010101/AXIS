-- =============================================
-- Morix Platform v7 — هيكل المدرسة (صفوف + شُعب) عبر ملف Excel
-- شغّل هذا السكريبت في Supabase SQL Editor مرة واحدة
-- =============================================

-- ============================================
-- جدول صفوف وشُعب المدرسة
--    كل صف فيه = (صف + شعبة) موجودة في المدرسة
--    يُملأ من ملف Excel عند إضافة المدرسة
-- ============================================
CREATE TABLE IF NOT EXISTS school_classes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    grade   VARCHAR(50) NOT NULL,
    section VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- منع تكرار نفس (الصف + الشعبة) لنفس المدرسة
CREATE UNIQUE INDEX IF NOT EXISTS uq_school_class
  ON school_classes(school_id, grade, COALESCE(section, ''));

CREATE INDEX IF NOT EXISTS idx_school_classes_school ON school_classes(school_id);

-- ============================================
-- تأكيد وجود عمود الفرع في schools (من migration_v4)
-- ============================================
ALTER TABLE schools ADD COLUMN IF NOT EXISTS branch VARCHAR(255);

-- ============================================
-- ✅ تم تنفيذ Migration v7
-- ============================================
SELECT 'Morix v7 migration completed — school_classes ready' AS status;
