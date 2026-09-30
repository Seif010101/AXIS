import {
  boolean,
  date,
  decimal,
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

// Homework, tests and worksheets are targeted at school + grade + optional section
// ('' = the whole grade).
const classTarget = () => ({
  schoolId: id("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  subject: varchar("subject", { length: 100 }).notNull().default(""),
  grade: varchar("grade", { length: 50 }).notNull(),
  section: varchar("section", { length: 50 }).notNull().default(""),
});

export const homework = mysqlTable(
  "homework",
  {
    id: pk(),
    teacherId: id("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...classTarget(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    dueDate: timestamp("due_date"),
    createdAt: createdAt(),
  },
  (t) => [
    index("homework_class_idx").on(t.schoolId, t.grade, t.section),
    index("homework_teacher_idx").on(t.teacherId),
  ],
);

export const homeworkSubmissions = mysqlTable(
  "homework_submissions",
  {
    id: pk(),
    homeworkId: id("homework_id")
      .notNull()
      .references(() => homework.id, { onDelete: "cascade" }),
    studentId: id("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    gradeScore: decimal("grade_score", { precision: 5, scale: 2 }),
    feedback: text("feedback"),
    submittedAt: timestamp("submitted_at").notNull(),
    gradedAt: timestamp("graded_at"),
  },
  (t) => [
    uniqueIndex("homework_submissions_unique").on(t.homeworkId, t.studentId),
    index("homework_submissions_student_idx").on(t.studentId),
  ],
);

export interface TestQuestion {
  id: string;
  question: string;
  options: Record<string, string>;
  // The correct option key. Stripped from every payload sent to students.
  answer: string;
  explanation?: string;
}

export const tests = mysqlTable(
  "tests",
  {
    id: pk(),
    teacherId: id("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...classTarget(),
    title: varchar("title", { length: 255 }).notNull(),
    questions: json<TestQuestion[]>("questions").notNull(),
    durationMinutes: int("duration_minutes").notNull().default(30),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    index("tests_class_idx").on(t.schoolId, t.grade, t.section),
    index("tests_teacher_idx").on(t.teacherId),
  ],
);

// One attempt per student per test. The row is created when the student starts (so the
// duration can be enforced on the server) and completed on submit.
export const testResults = mysqlTable(
  "test_results",
  {
    id: pk(),
    testId: id("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),
    studentId: id("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    answers: json<Record<string, string>>("answers"),
    score: decimal("score", { precision: 5, scale: 2 }),
    startedAt: timestamp("started_at").notNull(),
    completedAt: timestamp("completed_at"),
  },
  (t) => [
    uniqueIndex("test_results_attempt_unique").on(t.testId, t.studentId),
    index("test_results_student_idx").on(t.studentId),
  ],
);

export const worksheets = mysqlTable(
  "worksheets",
  {
    id: pk(),
    teacherId: id("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...classTarget(),
    title: varchar("title", { length: 255 }).notNull(),
    content: longtext("content").notNull(),
    aiGenerated: boolean("ai_generated").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("worksheets_class_idx").on(t.schoolId, t.grade, t.section),
    index("worksheets_teacher_idx").on(t.teacherId),
  ],
);

export const educationalGames = mysqlTable(
  "educational_games",
  {
    id: pk(),
    studentId: id("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameType: varchar("game_type", { length: 20 }).notNull(),
    subject: varchar("subject", { length: 100 }).notNull(),
    topic: varchar("topic", { length: 255 }),
    content: json<unknown>("content").notNull(),
    score: int("score"),
    completed: boolean("completed").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("educational_games_student_idx").on(t.studentId, t.createdAt)],
);

// Every star a student earns is a ledger row. `slot` numbers repeat awards of the same
// kind on the same day; the unique index makes the daily caps race-free.
export const starLedger = mysqlTable(
  "star_ledger",
  {
    id: pk(),
    userId: id("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 40 }).notNull(),
    day: date("day", { mode: "string" }).notNull(),
    slot: int("slot").notNull().default(0),
    amount: int("amount").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("star_ledger_cap_unique").on(t.userId, t.kind, t.day, t.slot)],
);

export interface DailyChallengeQuestion {
  question: string;
  options: Record<string, string>;
  answer: string;
  explanation?: string;
}

// One challenge per student per day. The answer stays on the server.
export const dailyChallenges = mysqlTable(
  "daily_challenges",
  {
    id: pk(),
    userId: id("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    subject: varchar("subject", { length: 100 }).notNull(),
    question: json<DailyChallengeQuestion>("question").notNull(),
    chosen: varchar("chosen", { length: 10 }),
    correct: boolean("correct"),
    answeredAt: timestamp("answered_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("daily_challenges_unique").on(t.userId, t.day)],
);

export const userSettings = mysqlTable("user_settings", {
  userId: id("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  theme: varchar("theme", { length: 20 }).notNull().default("dark"),
  language: varchar("language", { length: 5 }).notNull().default("ar"),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  difficulty: varchar("difficulty", { length: 10 }).notNull().default("medium"),
  hobbies: json<string[]>("hobbies"),
  tutorPersonality: varchar("tutor_personality", { length: 20 }).notNull().default("friend"),
  updatedAt: updatedAt(),
});
