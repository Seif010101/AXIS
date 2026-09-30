import {
  boolean,
  index,
  int,
  longtext,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { createdAt, id, json, pk, timestamp, updatedAt } from "./_columns";
import { users } from "./auth";
import { schools } from "./school";

// Curriculum library shared by all schools, curated by managers.
export const curriculumBooks = mysqlTable(
  "curriculum_books",
  {
    id: pk(),
    title: varchar("title", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 100 }).notNull(),
    grade: varchar("grade", { length: 50 }).notNull(),
    summary: text("summary"),
    keyConcepts: json<string[]>("key_concepts"),
    rawText: longtext("raw_text"),
    // Object key in file storage. Download links are presigned per request, never stored.
    filePath: varchar("file_path", { length: 500 }),
    fileName: varchar("file_name", { length: 255 }),
    fileSize: int("file_size"),
    mimeType: varchar("mime_type", { length: 100 }),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: id("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("curriculum_books_grade_idx").on(t.grade, t.subject)],
);

export const aiConversations = mysqlTable(
  "ai_conversations",
  {
    id: pk(),
    userId: id("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    bookId: id("book_id").references(() => curriculumBooks.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("ai_conversations_user_idx").on(t.userId, t.updatedAt)],
);

export const aiMessages = mysqlTable(
  "ai_messages",
  {
    id: pk(),
    conversationId: id("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).$type<"user" | "assistant">().notNull(),
    content: longtext("content").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("ai_messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

// Cache for deterministic, non-personal AI outputs only (e.g. book summaries).
// Chat replies are never cached: the legacy cache key ignored the user and attachments
// and served one user's reply to another.
export const contentCache = mysqlTable(
  "content_cache",
  {
    id: pk(),
    cacheKey: varchar("cache_key", { length: 64 }).notNull(),
    contentType: varchar("content_type", { length: 50 }).notNull(),
    content: json<unknown>("content").notNull(),
    hitCount: int("hit_count").notNull().default(0),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("content_cache_key_unique").on(t.cacheKey),
    index("content_cache_expiry_idx").on(t.expiresAt),
  ],
);

// One row per model call: real token counts for quotas and the owner's cost screen.
export const aiUsage = mysqlTable(
  "ai_usage",
  {
    id: pk(),
    userId: id("user_id").references(() => users.id, { onDelete: "set null" }),
    schoolId: id("school_id").references(() => schools.id, { onDelete: "set null" }),
    feature: varchar("feature", { length: 50 }).notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    inputTokens: int("input_tokens").notNull().default(0),
    outputTokens: int("output_tokens").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("ai_usage_user_idx").on(t.userId, t.createdAt),
    index("ai_usage_created_idx").on(t.createdAt),
  ],
);
