import { formatSydneyDateTime } from "@/lib/time";

interface HourSliderProps {
  /** Sorted, unique ISO hour timestamps present in the fetched window. */
  hours: string[];
  index: number;
  onChange: (index: number) => void;
}

/**
 * Lets the user scrub through the fetched window's hours — indexes into
 * already-fetched data rather than refetching. Rendered as a translucent bar
 * docked to the bottom of the map itself, so it needs to stay legible over
 * varying map tile colors underneath it.
 */
export function HourSlider({ hours, index, onChange }: HourSliderProps) {
  const selected = hours[index];
  const hasHours = hours.length > 0;

  return (
    <div className="flex flex-col gap-1 rounded-lg bg-slate-900/80 px-4 py-3 text-white shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2 text-sm font-medium">
        <span>Hour</span>
        <span className="text-right text-ocean-300">
          {selected ? formatSydneyDateTime(selected) : "No data"}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(hours.length - 1, 0)}
        step={1}
        value={hasHours ? index : 0}
        disabled={!hasHours}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-ocean-400 disabled:opacity-40"
        aria-label="Select hour"
      />
      <div className="flex justify-between text-[10px] text-slate-300">
        <span>{hasHours ? formatSydneyDateTime(hours[0]) : "—"}</span>
        <span>{hasHours ? formatSydneyDateTime(hours[hours.length - 1]) : "—"}</span>
      </div>
    </div>
  );
}
