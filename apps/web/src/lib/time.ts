// Sydney day/hour bucketing via Intl.DateTimeFormat — NOT manual UTC+10/+11
// offset arithmetic, so AEST/AEDT transitions are handled by the platform.

import type { LedgeCondition } from "./types";

export const SYDNEY_TZ = "Australia/Sydney";

/** Default hourly forecast window length, matching the backend's ~10-day fetch. */
export const DEFAULT_WINDOW_DAYS = 10;

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SYDNEY_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const hourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SYDNEY_TZ,
  hour: "numeric",
  hour12: false,
});

const dayLabelFormatter = new Intl.DateTimeFormat("en-AU", {
  // The dayKey string is already the Sydney calendar date; format it as a
  // plain UTC-midnight instant so we don't re-apply the Sydney offset and
  // risk shifting across a day boundary.
  timeZone: "UTC",
  weekday: "short",
  day: "2-digit",
  month: "short",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: SYDNEY_TZ,
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZoneName: "short",
});

const hourLabelFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: SYDNEY_TZ,
  hour: "numeric",
  hour12: true,
});

/** `'YYYY-MM-DD'` for the Sydney-local calendar day containing `tsIso`. */
export function toSydneyDayKey(tsIso: string): string {
  // en-CA formats as YYYY-MM-DD.
  return dayKeyFormatter.format(new Date(tsIso));
}

/** 0-23 for the Sydney-local hour containing `tsIso`. */
export function toSydneyHour(tsIso: string): number {
  const parts = hourFormatter.formatToParts(new Date(tsIso));
  const raw = parts.find((p) => p.type === "hour")?.value ?? "0";
  let hour = Number.parseInt(raw, 10);
  // Some Intl implementations render midnight as "24" even with hour12:false.
  if (hour === 24) hour = 0;
  return hour;
}

/** `'Wed 25 Aug'`-style label for a `'YYYY-MM-DD'` day key. */
export function formatSydneyDayLabel(dayKey: string): string {
  return dayLabelFormatter.format(new Date(`${dayKey}T00:00:00Z`));
}

/** `'Wed 25 Aug, 3:00 pm AEST'`-style label for a full timestamp. */
export function formatSydneyDateTime(tsIso: string): string {
  return dateTimeFormatter.format(new Date(tsIso));
}

/** `'3pm'`-style compact hour label, for the now-timeline's per-cell labels. */
export function formatSydneyHourLabel(tsIso: string): string {
  return hourLabelFormatter.format(new Date(tsIso)).replace(/\s+/g, "").toLowerCase();
}

/** `tsIso` shifted by a (possibly negative) number of hours, as an ISO string. */
export function addHoursIso(tsIso: string, hours: number): string {
  const date = new Date(tsIso);
  date.setUTCHours(date.getUTCHours() + hours);
  return date.toISOString();
}

/**
 * Groups a single ledge's condition series into Sydney calendar-day rows of
 * hour-of-day cells, for the per-ledge heat map grid. Missing hours (partial
 * first/last day, or upstream gaps) simply have no entry in the inner map —
 * callers should render those as empty/grey cells rather than crash.
 */
export function groupConditionsBySydneyDay(
  conditions: ReadonlyArray<LedgeCondition>,
): Map<string, Map<number, LedgeCondition>> {
  const byDay = new Map<string, Map<number, LedgeCondition>>();
  for (const condition of conditions) {
    const dayKey = toSydneyDayKey(condition.ts);
    const hour = toSydneyHour(condition.ts);
    let hourMap = byDay.get(dayKey);
    if (!hourMap) {
      hourMap = new Map();
      byDay.set(dayKey, hourMap);
    }
    hourMap.set(hour, condition);
  }
  return byDay;
}

/** Sorted (ascending) `'YYYY-MM-DD'` keys from a day-grouped map — lexical sort works since the key format is fixed-width. */
export function getSortedDayKeys(byDay: ReadonlyMap<string, unknown>): string[] {
  return Array.from(byDay.keys()).sort();
}

/** Distinct hour timestamps present across a (possibly multi-ledge) condition list, sorted ascending. ISO strings sort chronologically as-is. */
export function getUniqueSortedTimestamps(
  conditions: ReadonlyArray<Pick<LedgeCondition, "ts">>,
): string[] {
  const seen = new Set<string>();
  for (const c of conditions) seen.add(c.ts);
  return Array.from(seen).sort();
}

/** The current hour, truncated to the top of the hour, as an ISO string — matches the UTC top-of-hour `ts` grain the API uses. */
export function nowHourIso(): string {
  const now = new Date();
  now.setUTCMinutes(0, 0, 0);
  return now.toISOString();
}

/**
 * Default `{ fromIso, toIso }` fetch window: now (top of hour) through `days`
 * days later. `hoursBack` optionally extends `fromIso` into the past (e.g.
 * for the ledge detail page's now-centered timeline, which needs some
 * already-elapsed hours to show alongside the forecast) — 0 preserves the
 * original "starts exactly now" behavior for existing callers.
 */
export function getDefaultWindowIso(
  days: number = DEFAULT_WINDOW_DAYS,
  hoursBack: number = 0,
): {
  fromIso: string;
  toIso: string;
} {
  const nowHour = nowHourIso();
  const from = new Date(nowHour);
  from.setUTCHours(from.getUTCHours() - hoursBack);
  const to = new Date(nowHour);
  to.setUTCDate(to.getUTCDate() + days);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

/**
 * Index into a sorted hour-timestamp array closest to "now" — used as the
 * HourSlider's default position. Falls back to the next-available hour, then
 * the last hour in range, if "now" itself isn't present in the fetched data.
 */
export function findDefaultHourIndex(hours: ReadonlyArray<string>): number {
  if (hours.length === 0) return 0;
  const now = nowHourIso();
  const exact = hours.indexOf(now);
  if (exact !== -1) return exact;
  const next = hours.findIndex((h) => h > now);
  if (next !== -1) return next;
  return hours.length - 1;
}
