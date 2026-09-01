import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { TidePoint } from "@/lib/tide";
import { formatSydneyDateTime } from "@/lib/time";
import { formatTideReading, TideBackdrop } from "./TideStrip";

/**
 * Hours the slider spans at once. The backend fetches ~10 days, but dragging
 * across all of it makes every hour a pixel or two wide and impossible to
 * land on; three days is a usable scrubbing range. Everything past it is
 * still reachable by holding an arrow.
 */
const WINDOW_HOURS = 72;

/** How fast holding an arrow walks through time, and how long a press waits before it starts repeating. */
const HOLD_REPEAT_MS = 55;
const HOLD_DELAY_MS = 300;

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

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * A press-and-hold stepper. A single tap nudges one hour; holding walks
 * forward continuously, which is how the user reaches past the three-day
 * window without a slider so compressed it can't be aimed.
 */
function HoldArrow({
  direction,
  disabled,
  onStep,
  label,
}: {
  direction: "left" | "right";
  disabled: boolean;
  onStep: () => void;
  label: string;
}) {
  const timers = useRef<{ delay?: ReturnType<typeof setTimeout>; repeat?: ReturnType<typeof setInterval> }>({});
  // Held in a ref so the running interval always calls the current onStep
  // rather than the one captured when the press began.
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  const stop = useCallback(() => {
    if (timers.current.delay) clearTimeout(timers.current.delay);
    if (timers.current.repeat) clearInterval(timers.current.repeat);
    timers.current = {};
  }, []);

  const start = useCallback(() => {
    if (disabled) return;
    onStepRef.current();
    timers.current.delay = setTimeout(() => {
      timers.current.repeat = setInterval(() => onStepRef.current(), HOLD_REPEAT_MS);
    }, HOLD_DELAY_MS);
  }, [disabled]);

  // A press that ends off the button (or with the tab hidden) must not leave
  // the interval running.
  useEffect(() => stop, [stop]);

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-white/5"
      onPointerDown={(e) => {
        // Keeps the repeat running if the finger slides off the button.
        e.currentTarget.setPointerCapture(e.pointerId);
        start();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
    >
      <ChevronIcon direction={direction} />
    </button>
  );
}

/**
 * Lets the user scrub through the fetched window's hours — indexes into
 * already-fetched data rather than refetching. The slider itself spans three
 * days; the arrows either side walk the window through the rest of the
 * forecast when held. Rendered as a glass card docked beneath the map (in
 * normal document flow, not floating over the tiles), so the map itself
 * stays fully unobstructed.
 */
export function HourSlider({ hours, index, onChange, isLive = false, tideSeries }: HourSliderProps) {
  const hasHours = hours.length > 0;
  const lastIndex = Math.max(hours.length - 1, 0);
  const windowSize = Math.min(WINDOW_HOURS, Math.max(hours.length, 1));
  const maxStart = Math.max(hours.length - windowSize, 0);

  const [windowStart, setWindowStart] = useState(0);

  // Keep the selected hour in view — on first load that puts "now" on the
  // slider rather than stranding it off the left edge, and it also follows
  // the selection if something else moves it.
  useEffect(() => {
    setWindowStart((current) => {
      if (index < current) return Math.min(index, maxStart);
      if (index > current + windowSize - 1) return Math.min(index - windowSize + 1, maxStart);
      return Math.min(current, maxStart);
    });
  }, [index, windowSize, maxStart]);

  // Holding an arrow moves the selected hour, and the window comes with it
  // once the selection reaches the edge — so the map keeps updating as you
  // scan forward instead of the window sliding out from under a fixed hour.
  const step = useCallback(
    (delta: number) => {
      onChange(Math.min(Math.max(index + delta, 0), lastIndex));
    },
    [index, lastIndex, onChange],
  );

  const selected = hours[index];
  const windowEnd = Math.min(windowStart + windowSize - 1, lastIndex);
  const progressPct =
    windowSize > 1 ? ((index - windowStart) / (windowSize - 1)) * 100 : 0;

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

      <div className="flex items-center gap-2.5">
        <HoldArrow
          direction="left"
          disabled={!hasHours || index <= 0}
          onStep={() => step(-1)}
          label="Earlier — hold to rewind"
        />
        <div className="relative flex h-10 flex-1 items-center">
          {hasHours && <TideBackdrop tideSeries={tideSeries} from={windowStart} to={windowEnd} />}
          <input
            type="range"
            min={windowStart}
            max={windowEnd}
            step={1}
            value={hasHours ? Math.min(Math.max(index, windowStart), windowEnd) : 0}
            disabled={!hasHours}
            onChange={(e) => onChange(Number(e.target.value))}
            className="slider-modern relative z-10 w-full"
            style={{ "--slider-progress": `${progressPct}%` } as CSSProperties}
            aria-label="Select hour"
          />
        </div>
        <HoldArrow
          direction="right"
          disabled={!hasHours || index >= lastIndex}
          onStep={() => step(1)}
          label="Later — hold to fast forward"
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span>{hasHours ? formatSydneyDateTime(hours[windowStart]) : "—"}</span>
        {hasHours && (
          <span className="font-medium text-ocean-300">{formatTideReading(tideSeries, index)}</span>
        )}
        <span>{hasHours ? formatSydneyDateTime(hours[windowEnd]) : "—"}</span>
      </div>
    </div>
  );
}
