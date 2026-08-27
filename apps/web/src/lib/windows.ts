// Merges a sorted hourly condition series into contiguous "notable tier"
// windows (a run of dangerous hours, a run of good-fishing hours, etc.), for
// a plain-language summary list rather than a dense per-hour grid.

const ONE_HOUR_MS = 60 * 60 * 1000;

export interface TierWindow<T extends string> {
  /** ts of the first matching hour. */
  startTs: string;
  /** ts of the last matching hour — NOT the window's end boundary, which is
   * one hour later (each row covers the hour starting at its ts). */
  endTs: string;
  tier: T;
}

function isNextHour(prevTs: string, ts: string): boolean {
  return new Date(ts).getTime() - new Date(prevTs).getTime() === ONE_HOUR_MS;
}

/**
 * Walks `conditions` in ts order and merges consecutive hours sharing the
 * same notable tier into windows. "Consecutive" is checked by actual
 * elapsed time (exactly one hour apart), not array adjacency, so a data gap
 * (a missing hour) never bridges two otherwise-separate windows. A tier
 * change mid-run (e.g. caution -> dangerous) starts a new window even with
 * no gap, since the two tiers are reported separately.
 */
export function summarizeTierWindows<C extends { ts: string }, T extends string>(
  conditions: ReadonlyArray<C>,
  getTier: (condition: C) => T | null,
  notableTiers: ReadonlySet<T>,
): TierWindow<T>[] {
  const sorted = [...conditions].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  const windows: TierWindow<T>[] = [];
  let current: { startTs: string; endTs: string; tier: T } | null = null;

  for (const condition of sorted) {
    const tier = getTier(condition);
    const isNotable = tier !== null && notableTiers.has(tier);

    if (isNotable && current && current.tier === tier && isNextHour(current.endTs, condition.ts)) {
      current.endTs = condition.ts;
      continue;
    }

    if (current) windows.push(current);
    current = isNotable ? { startTs: condition.ts, endTs: condition.ts, tier: tier as T } : null;
  }
  if (current) windows.push(current);

  return windows;
}

/** Drops any window whose end boundary (endTs + 1h) has already passed. */
export function filterUpcomingWindows<T extends string>(
  windows: ReadonlyArray<TierWindow<T>>,
  nowIso: string,
): TierWindow<T>[] {
  const nowMs = new Date(nowIso).getTime();
  return windows.filter((w) => new Date(w.endTs).getTime() + ONE_HOUR_MS >= nowMs);
}
