import { boolean, index, int, mysqlTable, text, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { createdAt, id, json, pk, updatedAt } from "./_columns";
import { users } from "./auth";

export const schools = mysqlTable(
  "schools",
  {
    id: pk(),
    name: varchar("name", { length: 255 }).notNull(),
    branch: varchar("branch", { length: 255 }),
    ministryCode: varchar("ministry_code", { length: 50 }),
    setupCompleted: boolean("setup_completed").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  // A unique index allows many NULLs, so schools without a ministry code don't collide.
  (t) => [uniqueIndex("schools_ministry_code_unique").on(t.ministryCode)],
);

// Grade/section list of each school. `section` is '' for "whole grade" so the unique
// index works (NULLs would not be considered equal).
export const schoolClasses = mysqlTable(
  "school_classes",
  {
    id: pk(),
    schoolId: id("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    grade: varchar("grade", { length: 50 }).notNull(),
    section: varchar("section", { length: 50 }).notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("school_classes_unique").on(t.schoolId, t.grade, t.section)],
);

// Which grade/section/subject a teacher may target.
export const teacherAssignments = mysqlTable(
  "teacher_assignments",
  {
    id: pk(),
    teacherId: id("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    schoolId: id("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    grade: varchar("grade", { length: 50 }).notNull(),
    section: varchar("section", { length: 50 }).notNull().default(""),
    subject: varchar("subject", { length: 100 }).notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("teacher_assignments_unique").on(t.teacherId, t.grade, t.section, t.subject),
    index("teacher_assignments_class_idx").on(t.schoolId, t.grade, t.section),
  ],
);

export type JobStatus = "pending" | "running" | "completed" | "failed";

// Long operations run as client-driven chunks (POST /jobs/:id/next) so no single request
// has to outlive the platform's request timeout. Used for bulk account onboarding.
export const jobs = mysqlTable(
  "jobs",
  {
    id: pk(),
    type: varchar("type", { length: 50 }).notNull(),
    status: varchar("status", { length: 20 }).$type<JobStatus>().notNull().default("pending"),
    createdBy: id("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    schoolId: id("school_id").references(() => schools.id, { onDelete: "cascade" }),
    payload: json<unknown>("payload").notNull(),
    cursor: int("cursor").notNull().default(0),
    total: int("total").notNull().default(0),
    result: json<unknown>("result"),
    error: text("error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("jobs_creator_idx").on(t.createdBy, t.createdAt)],
);
