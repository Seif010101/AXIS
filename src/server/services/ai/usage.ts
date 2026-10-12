import "server-only";
import { and, count, gte, lt, sql, type SQL } from "drizzle-orm";
import { env } from "@/env";
import { db, schema } from "@/server/db";
import { estimateCostUsd } from "./pricing";

export type UsageGroupBy = "feature" | "school" | "day" | "model";

export interface UsageTotals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  /** Estimated from MODEL_PRICES, in US dollars. */
  estimatedCostUsd: number;
}

export interface UsageSummaryRow extends UsageTotals {
  /** Feature name, school id (null = no school, e.g. the owner), local day YYYY-MM-DD or model id. */
  key: string | null;
}

export interface UsageSummary {
  rows: UsageSummaryRow[];
  total: UsageTotals;
}

/** Current UTC offset of APP_TIME_ZONE in whole minutes (used to bucket days). */
function zoneOffsetMinutes(timeZone: string): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(new Date())
    .find((part) => part.type === "timeZoneName")?.value;
  const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name ?? "");
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === "-" ? -minutes : minutes;
}

function groupKey(groupBy: UsageGroupBy): SQL<string | null> {
  const usage = schema.aiUsage;
  switch (groupBy) {
    case "feature":
      return sql<string>`${usage.feature}`;
    case "school":
      return sql<string | null>`${usage.schoolId}`;
    case "model":
      return sql<string>`${usage.model}`;
    case "day": {
      // An integer we computed, inlined so the SELECT and GROUP BY expressions are identical.
      const offset = sql.raw(String(Math.trunc(zoneOffsetMinutes(env.APP_TIME_ZONE))));
      return sql<string>`DATE_FORMAT(DATE_ADD(${usage.createdAt}, INTERVAL ${offset} MINUTE), '%Y-%m-%d')`;
    }
  }
}

/**
 * Token totals and estimated cost of AI calls since `since` (and before `until`), grouped by
 * feature, school, local day or model. Aggregated in SQL (one row per group and model).
 * For the owner's AI-cost report: the caller must check the viewer is the owner.
 *
 * @example
 * const { rows, total } = await usageSummary({ since: thirtyDaysAgo, groupBy: "feature" });
 */
export async function usageSummary(options: {
  since: Date;
  until?: Date;
  groupBy: UsageGroupBy;
}): Promise<UsageSummary> {
  const usage = schema.aiUsage;
  const key = groupKey(options.groupBy);
  const conditions = [gte(usage.createdAt, options.since)];
  if (options.until) conditions.push(lt(usage.createdAt, options.until));

  const grouped = await db
    .select({
      key,
      model: usage.model,
      calls: count(),
      inputTokens: sql<number>`COALESCE(SUM(${usage.inputTokens}), 0)`.mapWith(Number),
      outputTokens: sql<number>`COALESCE(SUM(${usage.outputTokens}), 0)`.mapWith(Number),
    })
    .from(usage)
    .where(and(...conditions))
    .groupBy(key, usage.model);

  const byKey = new Map<string | null, UsageSummaryRow>();
  const total: UsageTotals = { calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };
  for (const row of grouped) {
    const cost = estimateCostUsd(row.model, row.inputTokens, row.outputTokens);
    const entry = byKey.get(row.key) ?? {
      key: row.key,
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
    };
    entry.calls += row.calls;
    entry.inputTokens += row.inputTokens;
    entry.outputTokens += row.outputTokens;
    entry.estimatedCostUsd += cost;
    byKey.set(row.key, entry);
    total.calls += row.calls;
    total.inputTokens += row.inputTokens;
    total.outputTokens += row.outputTokens;
    total.estimatedCostUsd += cost;
  }

  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  const rows = [...byKey.values()].map((row) => ({ ...row, estimatedCostUsd: round(row.estimatedCostUsd) }));
  rows.sort((a, b) =>
    options.groupBy === "day"
      ? String(a.key).localeCompare(String(b.key))
      : b.estimatedCostUsd - a.estimatedCostUsd || b.calls - a.calls,
  );
  return { rows, total: { ...total, estimatedCostUsd: round(total.estimatedCostUsd) } };
}
