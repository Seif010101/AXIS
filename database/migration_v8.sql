-- ============================================
-- Migration v8 — تخزين ملفات الكتب (Supabase Storage)
-- شغّل هذا الملف مرة واحدة في Supabase SQL Editor
-- ============================================

-- 1) أعمدة ملف الكتاب في جدول الكتب
ALTER TABLE curriculum_books ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE curriculum_books ADD COLUMN IF NOT EXISTS file_url  TEXT;
ALTER TABLE curriculum_books ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE curriculum_books ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE curriculum_books ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- 2) إنشاء bucket عام لتخزين الكتب (قراءة عامة، حد 50MB للملف)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('books', 'books', true, 52428800)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 52428800;

-- 3) سياسات الوصول لملفات bucket الكتب
--    bucket عام => القراءة عامة تلقائياً عبر /object/public/
--    الرفع يتم عبر signed URL موقّع بمفتاح الخدمة (يتجاوز RLS)
--    لو ظهر خطأ صلاحيات في الأسطر التالية تجاهلها — الـ bucket العام يكفي للعرض.
DROP POLICY IF EXISTS "books_public_read" ON storage.objects;
CREATE POLICY "books_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'books');

DROP POLICY IF EXISTS "books_write" ON storage.objects;
CREATE POLICY "books_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'books');

DROP POLICY IF EXISTS "books_delete" ON storage.objects;
CREATE POLICY "books_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'books');
