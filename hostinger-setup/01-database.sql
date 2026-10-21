-- =====================================================================================
--  قاعدة بيانات المنصة كاملة (MySQL / MariaDB) — جاهزة للاستيراد في phpMyAdmin على Hostinger
-- =====================================================================================
--
--  ملاحظة مهمة: التطبيق يُنشئ الجداول بنفسه عند أول تشغيل (src/instrumentation.ts)،
--  لذلك هذا الملف اختياري. استخدمه فقط إن أردت تجهيز القاعدة يدويًا قبل رفع التطبيق.
--
--  طريقة الاستيراد:
--    1) hPanel ← Databases ← Management: أنشئ قاعدة بيانات ومستخدمًا جديدين.
--    2) افتح phpMyAdmin للقاعدة ← تبويب Import ← اختر هذا الملف ← Go.
--    3) استوردْه على قاعدة **فارغة** فقط (يفشل إن كانت الجداول موجودة).
--
--  في آخر الملف تُسجَّل الـ migrations في جدول __drizzle_migrations بنفس البصمة (hash)
--  التي يستخدمها التطبيق، فلا يحاول التطبيق إنشاء الجداول مرة ثانية عند التشغيل.
--
--  التحقق بخطوتين: لا يحتاج أي جدول إضافي — يستخدم جدول two_factors
--  والعمود users.two_factor_enabled الموجودين هنا. كشف الروبوتات (Cloudflare Turnstile)
--  لا يخزّن شيئًا في القاعدة.
-- =====================================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

-- -------------------------------------------------------------------------------------
-- Migration 0000  (created_at = 1790957768117)
-- -------------------------------------------------------------------------------------
CREATE TABLE `accounts` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`account_id` varchar(255) NOT NULL,
	`provider_id` varchar(100) NOT NULL,
	`password` text,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` datetime(3),
	`refresh_token_expires_at` datetime(3),
	`scope` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `accounts_provider_account_unique` UNIQUE(`provider_id`,`account_id`)
);
CREATE TABLE `rate_limits` (
	`id` varchar(36) NOT NULL,
	`key` varchar(255) NOT NULL,
	`count` int NOT NULL,
	`last_request` bigint NOT NULL,
	CONSTRAINT `rate_limits_id` PRIMARY KEY(`id`),
	CONSTRAINT `rate_limits_key_unique` UNIQUE(`key`)
);
CREATE TABLE `sessions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`token` varchar(255) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`ip_address` varchar(64),
	`user_agent` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_token_unique` UNIQUE(`token`)
);
CREATE TABLE `step_ups` (
	`session_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`verified_at` datetime(3) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	CONSTRAINT `step_ups_session_id` PRIMARY KEY(`session_id`)
);
CREATE TABLE `throttles` (
	`key` varchar(191) NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	`window_started_at` datetime(3) NOT NULL,
	CONSTRAINT `throttles_key` PRIMARY KEY(`key`)
);
CREATE TABLE `two_factors` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`secret` text NOT NULL,
	`backup_codes` text NOT NULL,
	`verified` boolean DEFAULT true,
	`failed_verification_count` int DEFAULT 0,
	`locked_until` datetime(3),
	CONSTRAINT `two_factors_id` PRIMARY KEY(`id`)
);
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`full_name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`email_verified` boolean NOT NULL DEFAULT true,
	`avatar` varchar(500),
	`two_factor_enabled` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`role` varchar(20) NOT NULL DEFAULT 'student',
	`school_id` varchar(36),
	`grade` varchar(50),
	`section` varchar(50),
	`subject` varchar(100),
	`ministry_id` varchar(50),
	`learning_style` varchar(20),
	`is_active` boolean NOT NULL DEFAULT true,
	`must_change_password` boolean NOT NULL DEFAULT true,
	`last_login_at` datetime(3),
	`stars_count` int NOT NULL DEFAULT 0,
	`current_streak` int NOT NULL DEFAULT 0,
	`longest_streak` int NOT NULL DEFAULT 0,
	`last_streak_day` date,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
CREATE TABLE `verifications` (
	`id` varchar(36) NOT NULL,
	`identifier` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `verifications_id` PRIMARY KEY(`id`)
);
CREATE TABLE `jobs` (
	`id` varchar(36) NOT NULL,
	`type` varchar(50) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`created_by` varchar(36) NOT NULL,
	`school_id` varchar(36),
	`payload` longtext NOT NULL,
	`cursor` int NOT NULL DEFAULT 0,
	`total` int NOT NULL DEFAULT 0,
	`result` longtext,
	`error` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
CREATE TABLE `school_classes` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`grade` varchar(50) NOT NULL,
	`section` varchar(50) NOT NULL DEFAULT '',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `school_classes_id` PRIMARY KEY(`id`),
	CONSTRAINT `school_classes_unique` UNIQUE(`school_id`,`grade`,`section`)
);
CREATE TABLE `schools` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`branch` varchar(255),
	`ministry_code` varchar(50),
	`setup_completed` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `schools_id` PRIMARY KEY(`id`),
	CONSTRAINT `schools_ministry_code_unique` UNIQUE(`ministry_code`)
);
CREATE TABLE `teacher_assignments` (
	`id` varchar(36) NOT NULL,
	`teacher_id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`grade` varchar(50) NOT NULL,
	`section` varchar(50) NOT NULL DEFAULT '',
	`subject` varchar(100) NOT NULL DEFAULT '',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `teacher_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `teacher_assignments_unique` UNIQUE(`teacher_id`,`grade`,`section`,`subject`)
);
CREATE TABLE `daily_challenges` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`day` date NOT NULL,
	`subject` varchar(100) NOT NULL,
	`question` longtext NOT NULL,
	`chosen` varchar(10),
	`correct` boolean,
	`answered_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `daily_challenges_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_challenges_unique` UNIQUE(`user_id`,`day`)
);
CREATE TABLE `educational_games` (
	`id` varchar(36) NOT NULL,
	`student_id` varchar(36) NOT NULL,
	`game_type` varchar(20) NOT NULL,
	`subject` varchar(100) NOT NULL,
	`topic` varchar(255),
	`content` longtext NOT NULL,
	`score` int,
	`completed` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `educational_games_id` PRIMARY KEY(`id`)
);
CREATE TABLE `homework` (
	`id` varchar(36) NOT NULL,
	`teacher_id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`subject` varchar(100) NOT NULL DEFAULT '',
	`grade` varchar(50) NOT NULL,
	`section` varchar(50) NOT NULL DEFAULT '',
	`title` varchar(255) NOT NULL,
	`description` text,
	`due_date` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `homework_id` PRIMARY KEY(`id`)
);
CREATE TABLE `homework_submissions` (
	`id` varchar(36) NOT NULL,
	`homework_id` varchar(36) NOT NULL,
	`student_id` varchar(36) NOT NULL,
	`content` text NOT NULL,
	`grade_score` decimal(5,2),
	`feedback` text,
	`submitted_at` datetime(3) NOT NULL,
	`graded_at` datetime(3),
	CONSTRAINT `homework_submissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `homework_submissions_unique` UNIQUE(`homework_id`,`student_id`)
);
CREATE TABLE `star_ledger` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`kind` varchar(40) NOT NULL,
	`day` date NOT NULL,
	`slot` int NOT NULL DEFAULT 0,
	`amount` int NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `star_ledger_id` PRIMARY KEY(`id`),
	CONSTRAINT `star_ledger_cap_unique` UNIQUE(`user_id`,`kind`,`day`,`slot`)
);
CREATE TABLE `test_results` (
	`id` varchar(36) NOT NULL,
	`test_id` varchar(36) NOT NULL,
	`student_id` varchar(36) NOT NULL,
	`answers` longtext,
	`score` decimal(5,2),
	`started_at` datetime(3) NOT NULL,
	`completed_at` datetime(3),
	CONSTRAINT `test_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `test_results_attempt_unique` UNIQUE(`test_id`,`student_id`)
);
CREATE TABLE `tests` (
	`id` varchar(36) NOT NULL,
	`teacher_id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`subject` varchar(100) NOT NULL DEFAULT '',
	`grade` varchar(50) NOT NULL,
	`section` varchar(50) NOT NULL DEFAULT '',
	`title` varchar(255) NOT NULL,
	`questions` longtext NOT NULL,
	`duration_minutes` int NOT NULL DEFAULT 30,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `tests_id` PRIMARY KEY(`id`)
);
CREATE TABLE `user_settings` (
	`user_id` varchar(36) NOT NULL,
	`theme` varchar(20) NOT NULL DEFAULT 'dark',
	`language` varchar(5) NOT NULL DEFAULT 'ar',
	`notifications_enabled` boolean NOT NULL DEFAULT true,
	`difficulty` varchar(10) NOT NULL DEFAULT 'medium',
	`hobbies` longtext,
	`tutor_personality` varchar(20) NOT NULL DEFAULT 'friend',
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `user_settings_user_id` PRIMARY KEY(`user_id`)
);
CREATE TABLE `worksheets` (
	`id` varchar(36) NOT NULL,
	`teacher_id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`subject` varchar(100) NOT NULL DEFAULT '',
	`grade` varchar(50) NOT NULL,
	`section` varchar(50) NOT NULL DEFAULT '',
	`title` varchar(255) NOT NULL,
	`content` longtext NOT NULL,
	`ai_generated` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `worksheets_id` PRIMARY KEY(`id`)
);
CREATE TABLE `ai_conversations` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`book_id` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `ai_conversations_id` PRIMARY KEY(`id`)
);
CREATE TABLE `ai_messages` (
	`id` varchar(36) NOT NULL,
	`conversation_id` varchar(36) NOT NULL,
	`role` varchar(20) NOT NULL,
	`content` longtext NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `ai_messages_id` PRIMARY KEY(`id`)
);
CREATE TABLE `ai_usage` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`school_id` varchar(36),
	`feature` varchar(50) NOT NULL,
	`model` varchar(100) NOT NULL,
	`input_tokens` int NOT NULL DEFAULT 0,
	`output_tokens` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `ai_usage_id` PRIMARY KEY(`id`)
);
CREATE TABLE `content_cache` (
	`id` varchar(36) NOT NULL,
	`cache_key` varchar(64) NOT NULL,
	`content_type` varchar(50) NOT NULL,
	`content` longtext NOT NULL,
	`hit_count` int NOT NULL DEFAULT 0,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `content_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `content_cache_key_unique` UNIQUE(`cache_key`)
);
CREATE TABLE `curriculum_books` (
	`id` varchar(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`subject` varchar(100) NOT NULL,
	`grade` varchar(50) NOT NULL,
	`summary` text,
	`key_concepts` longtext,
	`raw_text` longtext,
	`file_path` varchar(500),
	`file_name` varchar(255),
	`file_size` int,
	`mime_type` varchar(100),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `curriculum_books_id` PRIMARY KEY(`id`)
);
CREATE TABLE `analytics_events` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`school_id` varchar(36),
	`event_type` varchar(50) NOT NULL,
	`event_data` longtext,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `analytics_events_id` PRIMARY KEY(`id`)
);
CREATE TABLE `announcement_reads` (
	`announcement_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`read_at` datetime(3) NOT NULL,
	CONSTRAINT `announcement_reads_announcement_id_user_id_pk` PRIMARY KEY(`announcement_id`,`user_id`)
);
CREATE TABLE `announcements` (
	`id` varchar(36) NOT NULL,
	`scope` varchar(20) NOT NULL,
	`school_id` varchar(36),
	`author_id` varchar(36),
	`title` varchar(200) NOT NULL,
	`content` text NOT NULL,
	`audience_roles` longtext,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `announcements_id` PRIMARY KEY(`id`)
);
CREATE TABLE `complaints` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`school_id` varchar(36),
	`type` varchar(20) NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`response` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `complaints_id` PRIMARY KEY(`id`)
);
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `step_ups` ADD CONSTRAINT `step_ups_session_id_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `step_ups` ADD CONSTRAINT `step_ups_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `two_factors` ADD CONSTRAINT `two_factors_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `users` ADD CONSTRAINT `users_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE set null ON UPDATE no action;
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `school_classes` ADD CONSTRAINT `school_classes_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `teacher_assignments` ADD CONSTRAINT `teacher_assignments_teacher_id_users_id_fk` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `teacher_assignments` ADD CONSTRAINT `teacher_assignments_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `daily_challenges` ADD CONSTRAINT `daily_challenges_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `educational_games` ADD CONSTRAINT `educational_games_student_id_users_id_fk` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `homework` ADD CONSTRAINT `homework_teacher_id_users_id_fk` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;
ALTER TABLE `homework` ADD CONSTRAINT `homework_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `homework_submissions` ADD CONSTRAINT `homework_submissions_homework_id_homework_id_fk` FOREIGN KEY (`homework_id`) REFERENCES `homework`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `homework_submissions` ADD CONSTRAINT `homework_submissions_student_id_users_id_fk` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `star_ledger` ADD CONSTRAINT `star_ledger_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `test_results` ADD CONSTRAINT `test_results_test_id_tests_id_fk` FOREIGN KEY (`test_id`) REFERENCES `tests`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `test_results` ADD CONSTRAINT `test_results_student_id_users_id_fk` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `tests` ADD CONSTRAINT `tests_teacher_id_users_id_fk` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;
ALTER TABLE `tests` ADD CONSTRAINT `tests_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `user_settings` ADD CONSTRAINT `user_settings_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `worksheets` ADD CONSTRAINT `worksheets_teacher_id_users_id_fk` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;
ALTER TABLE `worksheets` ADD CONSTRAINT `worksheets_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `ai_conversations` ADD CONSTRAINT `ai_conversations_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `ai_conversations` ADD CONSTRAINT `ai_conversations_book_id_curriculum_books_id_fk` FOREIGN KEY (`book_id`) REFERENCES `curriculum_books`(`id`) ON DELETE set null ON UPDATE no action;
ALTER TABLE `ai_messages` ADD CONSTRAINT `ai_messages_conversation_id_ai_conversations_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversations`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `ai_usage` ADD CONSTRAINT `ai_usage_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
ALTER TABLE `ai_usage` ADD CONSTRAINT `ai_usage_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE set null ON UPDATE no action;
ALTER TABLE `curriculum_books` ADD CONSTRAINT `curriculum_books_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
ALTER TABLE `analytics_events` ADD CONSTRAINT `analytics_events_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
ALTER TABLE `analytics_events` ADD CONSTRAINT `analytics_events_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE set null ON UPDATE no action;
ALTER TABLE `announcement_reads` ADD CONSTRAINT `announcement_reads_announcement_id_announcements_id_fk` FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `announcement_reads` ADD CONSTRAINT `announcement_reads_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
ALTER TABLE `complaints` ADD CONSTRAINT `complaints_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `complaints` ADD CONSTRAINT `complaints_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE set null ON UPDATE no action;
CREATE INDEX `accounts_user_idx` ON `accounts` (`user_id`);
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);
CREATE INDEX `two_factors_user_idx` ON `two_factors` (`user_id`);
CREATE INDEX `users_school_role_idx` ON `users` (`school_id`,`role`);
CREATE INDEX `users_class_idx` ON `users` (`school_id`,`grade`,`section`);
CREATE INDEX `users_last_login_idx` ON `users` (`last_login_at`);
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);
CREATE INDEX `jobs_creator_idx` ON `jobs` (`created_by`,`created_at`);
CREATE INDEX `teacher_assignments_class_idx` ON `teacher_assignments` (`school_id`,`grade`,`section`);
CREATE INDEX `educational_games_student_idx` ON `educational_games` (`student_id`,`created_at`);
CREATE INDEX `homework_class_idx` ON `homework` (`school_id`,`grade`,`section`);
CREATE INDEX `homework_teacher_idx` ON `homework` (`teacher_id`);
CREATE INDEX `homework_submissions_student_idx` ON `homework_submissions` (`student_id`);
CREATE INDEX `test_results_student_idx` ON `test_results` (`student_id`);
CREATE INDEX `tests_class_idx` ON `tests` (`school_id`,`grade`,`section`);
CREATE INDEX `tests_teacher_idx` ON `tests` (`teacher_id`);
CREATE INDEX `worksheets_class_idx` ON `worksheets` (`school_id`,`grade`,`section`);
CREATE INDEX `worksheets_teacher_idx` ON `worksheets` (`teacher_id`);
CREATE INDEX `ai_conversations_user_idx` ON `ai_conversations` (`user_id`,`updated_at`);
CREATE INDEX `ai_messages_conversation_idx` ON `ai_messages` (`conversation_id`,`created_at`);
CREATE INDEX `ai_usage_user_idx` ON `ai_usage` (`user_id`,`created_at`);
CREATE INDEX `ai_usage_created_idx` ON `ai_usage` (`created_at`);
CREATE INDEX `content_cache_expiry_idx` ON `content_cache` (`expires_at`);
CREATE INDEX `curriculum_books_grade_idx` ON `curriculum_books` (`grade`,`subject`);
CREATE INDEX `analytics_user_idx` ON `analytics_events` (`user_id`,`event_type`,`created_at`);
CREATE INDEX `analytics_school_idx` ON `analytics_events` (`school_id`,`event_type`,`created_at`);
CREATE INDEX `analytics_type_idx` ON `analytics_events` (`event_type`,`created_at`);
CREATE INDEX `announcements_scope_idx` ON `announcements` (`scope`,`school_id`,`created_at`);
CREATE INDEX `complaints_status_idx` ON `complaints` (`status`,`created_at`);

-- -------------------------------------------------------------------------------------
-- Migration 0001  (created_at = 1791747669110)
-- -------------------------------------------------------------------------------------
CREATE TABLE `notes` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL DEFAULT '',
	`content` longtext NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `notes_id` PRIMARY KEY(`id`)
);
ALTER TABLE `notes` ADD CONSTRAINT `notes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
CREATE INDEX `notes_user_idx` ON `notes` (`user_id`,`updated_at`);

SET FOREIGN_KEY_CHECKS = 1;

-- -------------------------------------------------------------------------------------
-- سجل الـ migrations (يطابق drizzle-kit والتطبيق تمامًا، لا تعدّله)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (id serial primary key, hash text not null, created_at bigint);
INSERT INTO `__drizzle_migrations` (hash, created_at) VALUES ('cb50892d9375d835a8d76d65c72735693a89dd91e60c8fe45e90a0af4ba73003', 1790957768117);
INSERT INTO `__drizzle_migrations` (hash, created_at) VALUES ('834352c989e2a0881c04d4c1f4373aec3c500596d2963a40507ee84691b10689', 1791747669110);
