import { useEffect, useState } from "react";

const DEFAULT_INTERVAL_MS = 60 * 1000;

/**
 * Forces a re-render on an interval so anything computing "now" (e.g. which
 * hour cell is current in the now-timeline) stays accurate between data
 * refetches, without triggering any network activity itself. The returned
 * value has no meaning beyond "it changed" — callers use it purely as an
 * effect/render dependency.
 */
export function useNowTick(intervalMs: number = DEFAULT_INTERVAL_MS): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return tick;
}
