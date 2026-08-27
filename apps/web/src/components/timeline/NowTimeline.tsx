import { useEffect, useMemo, useRef } from "react";
import { DANGER_TIER_BLOCK_CLASSES, DANGER_TIER_LABELS } from "@/components/shared/DangerBadge";
import { FISHING_TIER_BLOCK_CLASSES, FISHING_TIER_LABELS } from "@/components/shared/FishingBadge";
import { useNowTick } from "@/hooks/useNowTick";
import {
  findDefaultHourIndex,
  formatSydneyDateTime,
  formatSydneyDayLabel,
  getUniqueSortedTimestamps,
  toSydneyDayKey,
} from "@/lib/time";
import type { DangerTier, FishingTier, LedgeCondition } from "@/lib/types";
import type { TierWindow } from "@/lib/windows";

/** How far back the fetch window reaches so the timeline has real elapsed hours to its left. */
export const TIMELINE_LOOKBACK_HOURS = 12;

const PX_PER_HOUR = 6;
const TRACK_HEIGHT = 14;

interface DayBoundary {
  index: number;
  label: string;
}

function computeDayBoundaries(hours: readonly string[]): DayBoundary[] {
  const boundaries: DayBoundary[] = [];
  let lastDayKey: string | null = null;
  hours.forEach((ts, i) => {
    const dayKey = toSydneyDayKey(ts);
    if (dayKey !== lastDayKey) {
      boundaries.push({ index: i, label: formatSydneyDayLabel(dayKey) });
      lastDayKey = dayKey;
    }
  });
  return boundaries;
}

interface TimelineTrackProps<T extends string> {
  icon: string;
  label: string;
  windows: TierWindow<T>[];
  tsToIndex: Map<string, number>;
  blockClasses: Record<T, string>;
  tierLabels: Record<T, string>;
}

function TimelineTrack<T extends string>({
  icon,
  label,
  windows,
  tsToIndex,
  blockClasses,
  tierLabels,
}: TimelineTrackProps<T>) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] text-slate-500">
        {icon} {label}
      </span>
      <div className="relative flex-1 rounded-full bg-slate-100" style={{ height: TRACK_HEIGHT }}>
        {windows.map((w) => {
          const startIndex = tsToIndex.get(w.startTs);
          const endIndex = tsToIndex.get(w.endTs);
          if (startIndex === undefined || endIndex === undefined) return null;
          const left = startIndex * PX_PER_HOUR;
          const width = Math.max(PX_PER_HOUR, (endIndex - startIndex + 1) * PX_PER_HOUR);
          return (
            <div
              key={`${w.startTs}-${w.tier}`}
              className={`absolute top-0 rounded-full ${blockClasses[w.tier]}`}
              style={{ left, width, height: TRACK_HEIGHT }}
              title={`${tierLabels[w.tier]}: ${formatSydneyDateTime(w.startTs)} – ${formatSydneyDateTime(
                w.endTs,
              )}`}
            />
          );
        })}
      </div>
    </div>
  );
}

interface NowTimelineProps {
  conditions: LedgeCondition[];
  dangerWindows: TierWindow<DangerTier>[];
  biteWindows: TierWindow<FishingTier>[];
}

/**
 * Two horizontal lines (danger, bite) spanning the whole fetched forecast,
 * with a fixed "NOW" marker centered in the viewport and colored blocks
 * wherever a notable window falls — no per-hour boxes, no boxed list below
 * it. Auto-scrolls so "now" sits under the marker on load and whenever the
 * underlying "now" hour advances; scrolling right reveals the rest of the
 * forecast, scrolling left reveals the recent past.
 */
export function NowTimeline({ conditions, dangerWindows, biteWindows }: NowTimelineProps) {
  useNowTick();

  const hours = useMemo(() => getUniqueSortedTimestamps(conditions), [conditions]);
  const tsToIndex = useMemo(() => {
    const map = new Map<string, number>();
    hours.forEach((ts, i) => map.set(ts, i));
    return map;
  }, [hours]);
  const dayBoundaries = useMemo(() => computeDayBoundaries(hours), [hours]);

  const nowIndex = findDefaultHourIndex(hours);
  const nowTs = hours[nowIndex] as string | undefined;
  const totalWidth = hours.length * PX_PER_HOUR;
  const nowOffset = nowIndex * PX_PER_HOUR + PX_PER_HOUR / 2;

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = Math.max(0, Math.min(totalWidth - el.clientWidth, nowOffset - el.clientWidth / 2));
    el.scrollTo({ left: target, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowTs, totalWidth]);

  if (hours.length === 0) {
    return <p className="text-sm text-slate-500">Loading timeline…</p>;
  }

  return (
    <div className="relative rounded-lg border border-slate-200 bg-white px-2 py-3 shadow-sm">
      <div
        className="pointer-events-none absolute inset-y-1 left-1/2 z-10 flex w-0.5 -translate-x-1/2 flex-col items-center rounded bg-ocean-600/70"
        aria-hidden="true"
      >
        <span className="-mt-4 whitespace-nowrap rounded bg-ocean-600 px-1 text-[10px] font-bold text-white">
          NOW
        </span>
      </div>

      <div ref={scrollRef} className="overflow-x-auto pl-16">
        <div className="relative" style={{ width: totalWidth }}>
          <div className="relative h-4 border-b border-slate-100 text-[10px] text-slate-400">
            {dayBoundaries.map((b) => (
              <span
                key={b.index}
                className="absolute top-0 whitespace-nowrap border-l border-slate-200 pl-1"
                style={{ left: b.index * PX_PER_HOUR }}
              >
                {b.label}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-2 py-2">
            <TimelineTrack
              icon="⚠️"
              label="Danger"
              windows={dangerWindows}
              tsToIndex={tsToIndex}
              blockClasses={DANGER_TIER_BLOCK_CLASSES}
              tierLabels={DANGER_TIER_LABELS}
            />
            <TimelineTrack
              icon="🎣"
              label="Bite"
              windows={biteWindows}
              tsToIndex={tsToIndex}
              blockClasses={FISHING_TIER_BLOCK_CLASSES}
              tierLabels={FISHING_TIER_LABELS}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
