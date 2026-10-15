import "server-only";
import { and, inArray, like, or } from "drizzle-orm";
import { schema } from "@/server/db";
import type { Executor } from "@/server/services/stars";

// analytics_events.user_id is ON DELETE SET NULL (so platform statistics survive), which
// would keep a deleted student's personal notes (mood, reflections…) as orphans. Every
// event type that carries personal content is listed here and deleted together with its
// user. Areas that write personal text into analytics_events must add their type here.
export const PRIVATE_EVENT_TYPES = ["mood_tracker", "reflection", "diagnostic_completed", "feedback_seen"] as const;
const PRIVATE_EVENT_PREFIXES = ["focus_session"] as const;

/** Deletes the private analytics events of the given users (call before deleting them). */
export async function deletePrivateEvents(executor: Executor, userIds: readonly string[]): Promise<void> {
  if (userIds.length === 0) return;
  const { analyticsEvents } = schema;
  await executor
    .delete(analyticsEvents)
    .where(
      and(
        inArray(analyticsEvents.userId, [...userIds]),
        or(
          inArray(analyticsEvents.eventType, [...PRIVATE_EVENT_TYPES]),
          ...PRIVATE_EVENT_PREFIXES.map((prefix) => like(analyticsEvents.eventType, `${prefix}%`)),
        ),
      ),
    );
}
