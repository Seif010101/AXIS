-- =============================================
-- Morix Platform v5 — UI Overhaul + Stats Fix
-- شغّل هذا السكريبت في Supabase SQL Editor
-- =============================================

-- ============================================
-- 0. إضافة school_id لـ ai_conversations
--    (مطلوب لإحصائيات المدير + أمان المدرسة)
-- ============================================
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ai_conversations_school ON ai_conversations(school_id);

-- ============================================
-- 1. إضافة school_id لـ curriculum_books
--    (لتمييز كتب كل مدرسة عن الأخرى)
-- ============================================
ALTER TABLE curriculum_books ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_curriculum_books_school ON curriculum_books(school_id);

-- ============================================
-- 2. إضافة user_id لـ analytics (بديل student_id)
--    analytics حالياً يستخدم student_id فقط
--    نضيف user_id كـ alias مريح
-- ============================================
-- (لا حاجة لتغيير — student_id يُستخدم لكل الأدوار)

-- ============================================
-- 3. تأكيد إن complaints.school_id موجودة
-- ============================================
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_complaints_school ON complaints(school_id);

-- ============================================
-- 4. إضافة grade لـ users لو مش موجودة
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS grade VARCHAR(50);

-- ============================================
-- 5. تأكيد إن educational_games.student_id موجودة
-- ============================================
ALTER TABLE educational_games ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_games_school ON educational_games(school_id);

-- ============================================
-- 6. إضافة school_id لـ homework و tests
-- ============================================
ALTER TABLE homework ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_homework_school ON homework(school_id);

ALTER TABLE tests ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tests_school ON tests(school_id);

ALTER TABLE worksheets ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_worksheets_school ON worksheets(school_id);

-- ============================================
-- 7. تأكيد إن badges.user_id موجودة
-- ============================================
ALTER TABLE badges ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_badges_school ON badges(school_id);

-- ============================================
-- 8. إضافة raw_text لـ curriculum_books
--    لو لم يكن موجوداً
-- ============================================
ALTER TABLE curriculum_books ADD COLUMN IF NOT EXISTS raw_text TEXT;

-- ============================================
-- ✅ تم تنفيذ Migration v5
-- ============================================
SELECT 'Morix v5 migration completed successfully' AS status;
