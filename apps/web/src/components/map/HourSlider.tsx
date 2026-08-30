import type { CSSProperties } from "react";
import type { TidePoint } from "@/lib/tide";
import { formatSydneyDateTime } from "@/lib/time";
import { formatTideReading, TideBackdrop } from "./TideStrip";

interface HourSliderProps {
  /** Sorted, unique ISO hour timestamps present in the fetched window. */
  hours: string[];
  index: number;
  onChange: (index: number) => void;
  /** True when the map is following the current hour rather than a manually-scrubbed one. */
  isLive?: boolean;
  /** Same length/order as `hours` — one averaged tide reading per hour. */
  tideSeries: TidePoint[];
}

function LiveDot() {
  return (
    <span className="relative flex h-1.5 w-1.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
    </span>
  );
}

/**
 * Lets the user scrub through the fetched window's hours — indexes into
 * already-fetched data rather than refetching. Rendered as a glass card
 * docked beneath the map (in normal document flow, not floating over the
 * tiles), so the map itself stays fully unobstructed.
 */
export function HourSlider({ hours, index, onChange, isLive = false, tideSeries }: HourSliderProps) {
  const selected = hours[index];
  const hasHours = hours.length > 0;
  const progressPct = hasHours ? (index / Math.max(hours.length - 1, 1)) * 100 : 0;

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-slate-900/75 px-5 py-3.5 text-white shadow-2xl shadow-black/40 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
          {isLive && <LiveDot />}
          <span>{isLive ? "Live" : "Hour"}</span>
        </div>
        <span className="text-right text-sm font-semibold tracking-tight text-ocean-300">
          {selected ? formatSydneyDateTime(selected) : "No data"}
        </span>
      </div>
      <div className="relative flex h-10 items-center">
        {hasHours && <TideBackdrop tideSeries={tideSeries} />}
        <input
          type="range"
          min={0}
          max={Math.max(hours.length - 1, 0)}
          step={1}
          value={hasHours ? index : 0}
          disabled={!hasHours}
          onChange={(e) => onChange(Number(e.target.value))}
          className="slider-modern relative z-10 w-full"
          style={{ "--slider-progress": `${progressPct}%` } as CSSProperties}
          aria-label="Select hour"
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span>{hasHours ? formatSydneyDateTime(hours[0]) : "—"}</span>
        {hasHours && (
          <span className="font-medium text-ocean-300">{formatTideReading(tideSeries, index)}</span>
        )}
        <span>{hasHours ? formatSydneyDateTime(hours[hours.length - 1]) : "—"}</span>
      </div>
    </div>
  );
}
