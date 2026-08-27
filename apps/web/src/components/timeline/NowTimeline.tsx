import { useEffect, useMemo, useRef } from "react";
import { buildConditionTooltip } from "@/components/heatmap/HeatmapCell";
import { useNowTick } from "@/hooks/useNowTick";
import { DANGER_BORDER_CLASS, DANGER_HATCH_BACKGROUND, lliToColor } from "@/lib/colorScale";
import { findDefaultHourIndex, formatSydneyHourLabel, getUniqueSortedTimestamps } from "@/lib/time";
import type { LedgeCondition } from "@/lib/types";

/** How far back/forward the strip reaches around "now" — together, about a day's span. */
export const TIMELINE_HOURS_BACK = 12;
export const TIMELINE_HOURS_FORWARD = 12;

function isDangerLike(condition: LedgeCondition | null): boolean {
  return condition?.dangerTier != null && condition.dangerTier !== "normal";
}

interface NowTimelineProps {
  conditions: LedgeCondition[];
}

/**
 * A horizontally-scrollable strip of hour cells centered on "now" — past
 * hours to the left, future to the right, a fixed center marker pins "now"
 * in the middle. As real time advances (checked every ~60s via useNowTick,
 * independent of the data refetch interval), the strip re-centers itself,
 * so it reads as continuously shifting right-to-left rather than a static
 * multi-day grid.
 */
export function NowTimeline({ conditions }: NowTimelineProps) {
  useNowTick();

  const hours = useMemo(() => getUniqueSortedTimestamps(conditions), [conditions]);
  const byTs = useMemo(() => {
    const map = new Map<string, LedgeCondition>();
    for (const condition of conditions) map.set(condition.ts, condition);
    return map;
  }, [conditions]);

  const nowIndex = findDefaultHourIndex(hours);
  const windowStart = Math.max(0, nowIndex - TIMELINE_HOURS_BACK);
  const windowEnd = Math.min(hours.length, nowIndex + TIMELINE_HOURS_FORWARD + 1);
  const windowHours = hours.slice(windowStart, windowEnd);
  const nowIndexInWindow = nowIndex - windowStart;
  const nowTs = hours[nowIndex] as string | undefined;

  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    cellRefs.current[nowIndexInWindow]?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
    // Re-run whenever the underlying "now" hour changes (data reload or the
    // clock ticking past the hour) or the window itself is repositioned.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowTs, nowIndexInWindow]);

  if (windowHours.length === 0) {
    return <p className="text-sm text-slate-500">Loading timeline…</p>;
  }

  return (
    <div className="relative rounded-lg border border-slate-200 bg-white py-3 shadow-sm">
      <div
        className="pointer-events-none absolute inset-y-1 left-1/2 z-10 w-0.5 -translate-x-1/2 rounded bg-ocean-600/70"
        aria-hidden="true"
      />
      <div className="flex gap-1 overflow-x-auto px-[50%] scroll-smooth" style={{ scrollSnapType: "x proximity" }}>
        {windowHours.map((ts, i) => {
          const condition = byTs.get(ts) ?? null;
          const isNow = i === nowIndexInWindow;
          const danger = isDangerLike(condition);

          return (
            <div
              key={ts}
              ref={(el) => {
                cellRefs.current[i] = el;
              }}
              className="flex w-9 shrink-0 flex-col items-center gap-1"
              style={{ scrollSnapAlign: isNow ? "center" : "none" }}
            >
              <span
                className={`text-[10px] ${isNow ? "font-bold text-ocean-700" : "text-slate-400"}`}
              >
                {isNow ? "NOW" : formatSydneyHourLabel(ts)}
              </span>
              <div
                className={`h-10 w-8 rounded-sm ${danger ? DANGER_BORDER_CLASS : "border border-slate-200"} ${
                  isNow ? "ring-2 ring-ocean-600 ring-offset-1" : ""
                }`}
                style={{
                  backgroundColor: lliToColor(condition?.lli ?? null),
                  backgroundImage: danger ? DANGER_HATCH_BACKGROUND : undefined,
                }}
                title={condition ? buildConditionTooltip(condition) : "No data for this hour"}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
