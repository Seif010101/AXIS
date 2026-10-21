-- =====================================================================================
--  استعلامات إدارة التحقق بخطوتين (Microsoft Authenticator) — تُشغَّل من phpMyAdmin ← SQL
-- =====================================================================================
--  التحقق بخطوتين صار إلزاميًا لكل الحسابات (المالك، المدير، الإداري، المعلم، الطالب).
--  أي حساب لم يفعّله يُحوَّل تلقائيًا إلى صفحة /setup-2fa بعد تسجيل الدخول، ولا يستطيع
--  استخدام المنصة قبل إكماله. لا يلزم تشغيل أي شيء هنا لتفعيل الإلزام — هذه أدوات متابعة.
-- =====================================================================================


-- 1) نسبة التفعيل حسب الدور ---------------------------------------------------------------
SELECT
  role                                                    AS `الدور`,
  COUNT(*)                                                AS `عدد الحسابات`,
  SUM(two_factor_enabled = 1)                             AS `مفعّل`,
  SUM(two_factor_enabled = 0)                             AS `غير مفعّل`,
  ROUND(100 * SUM(two_factor_enabled = 1) / COUNT(*), 1)  AS `نسبة التفعيل %`
FROM users
WHERE is_active = 1
GROUP BY role
ORDER BY FIELD(role, 'owner', 'manager', 'admin', 'teacher', 'student');


-- 2) الحسابات التي لم تفعّل بعد، مع المدرسة وآخر دخول (للمتابعة مع المدارس) ---------------
SELECT
  u.full_name   AS `الاسم`,
  u.email       AS `البريد`,
  u.role        AS `الدور`,
  s.name        AS `المدرسة`,
  u.grade       AS `الصف`,
  u.section     AS `الشعبة`,
  u.last_login_at AS `آخر دخول (UTC)`,
  CASE WHEN tf.id IS NOT NULL THEN 'بدأ ولم يُكمل' ELSE 'لم يبدأ' END AS `الحالة`
FROM users u
LEFT JOIN schools s      ON s.id = u.school_id
LEFT JOIN two_factors tf ON tf.user_id = u.id
WHERE u.is_active = 1
  AND u.two_factor_enabled = 0
ORDER BY s.name, u.role, u.grade, u.section, u.full_name;


-- 3) إعادة تعيين التحقق بخطوتين لمستخدم فقد هاتفه --------------------------------------
--    الطريقة العادية صارت من الواجهة: صفحة الحسابات ← قائمة الإجراءات بجانب الحساب ←
--    «إعادة تعيين التحقق بخطوتين» (تطلب رمز المصادقة من الإداري وتُسجَّل في سجل العمليات).
--    استخدم هذا الاستعلام فقط لحساب المالك نفسه، أو إذا تعذّر الوصول للواجهة.
--    بعدها يسجّل الدخول بكلمة المرور فقط، ثم يُطلب منه ربط Microsoft Authenticator من جديد.
--    ⚠️ تحقّق من هوية الشخص قبل التنفيذ (هذا يتجاوز حماية الهاتف). غيّر البريد ثم شغّل الأوامر الأربعة معًا.
SET @email = 'student@example.com';

DELETE tf FROM two_factors tf JOIN users u ON u.id = tf.user_id WHERE u.email = @email;
DELETE su FROM step_ups su    JOIN users u ON u.id = su.user_id WHERE u.email = @email;
DELETE se FROM sessions se    JOIN users u ON u.id = se.user_id WHERE u.email = @email;   -- يُخرجه من كل الأجهزة
UPDATE users SET two_factor_enabled = 0 WHERE email = @email;

-- للتأكد:
SELECT email, role, two_factor_enabled FROM users WHERE email = @email;


-- 4) آخر عمليات الدخول الناجحة (آخر 7 أيام) --------------------------------------------
SELECT
  DATE(e.created_at) AS `اليوم`,
  JSON_UNQUOTE(JSON_EXTRACT(e.event_data, '$.role')) AS `الدور`,
  COUNT(*) AS `عدد مرات الدخول`
FROM analytics_events e
WHERE e.event_type = 'login'
  AND e.created_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY
GROUP BY `اليوم`, `الدور`
ORDER BY `اليوم` DESC, `الدور`;
