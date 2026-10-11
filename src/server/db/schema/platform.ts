import { index, mysqlTable, primaryKey, text, varchar } from "drizzle-orm/mysql-core";
import { createdAt, id, json, pk, timestamp, updatedAt } from "./_columns";
import { users } from "./auth";
import { schools } from "./school";
import type { Role } from "@/server/policy/roles";

// Activity log: logins, AI calls, mood entries, focus sessions, reflections…
export const analyticsEvents = mysqlTable(
  "analytics_events",
  {
    id: pk(),
    userId: id("user_id").references(() => users.id, { onDelete: "set null" }),
    schoolId: id("school_id").references(() => schools.id, { onDelete: "set null" }),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    eventData: json<Record<string, unknown>>("event_data"),
    createdAt: createdAt(),
  },
  (t) => [
    index("analytics_user_idx").on(t.userId, t.eventType, t.createdAt),
    index("analytics_school_idx").on(t.schoolId, t.eventType, t.createdAt),
    index("analytics_type_idx").on(t.eventType, t.createdAt),
  ],
);

export const complaints = mysqlTable(
  "complaints",
  {
    id: pk(),
    userId: id("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    schoolId: id("school_id").references(() => schools.id, { onDelete: "set null" }),
    type: varchar("type", { length: 20 }).$type<"complaint" | "suggestion" | "bug">().notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    status: varchar("status", { length: 20 })
      .$type<"pending" | "reviewed" | "resolved">()
      .notNull()
      .default("pending"),
    response: text("response"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("complaints_status_idx").on(t.status, t.createdAt)],
);

// School announcements (admin) and platform broadcasts (owner). In the legacy app these
// were written to the analytics table and never shown to anyone.
export const announcements = mysqlTable(
  "announcements",
  {
    id: pk(),
    scope: varchar("scope", { length: 20 }).$type<"platform" | "school">().notNull(),
    schoolId: id("school_id").references(() => schools.id, { onDelete: "cascade" }),
    authorId: id("author_id").references(() => users.id, { onDelete: "set null" }),
    title: varchar("title", { length: 200 }).notNull(),
    content: text("content").notNull(),
    // null = every role in scope.
    audienceRoles: json<Role[]>("audience_roles"),
    createdAt: createdAt(),
  },
  (t) => [index("announcements_scope_idx").on(t.scope, t.schoolId, t.createdAt)],
);

export const announcementReads = mysqlTable(
  "announcement_reads",
  {
    announcementId: id("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    userId: id("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.announcementId, t.userId] })],
);
