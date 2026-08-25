import { formatSydneyDateTime } from "@/lib/time";

interface HourSliderProps {
  /** Sorted, unique ISO hour timestamps present in the fetched window. */
  hours: string[];
  index: number;
  onChange: (index: number) => void;
}

/** Lets the user pick an hour within the fetched window; indexes into already-fetched data rather than refetching. */
export function HourSlider({ hours, index, onChange }: HourSliderProps) {
  const selected = hours[index];
  const hasHours = hours.length > 0;

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 text-sm font-medium text-slate-700">
        <span>Hour</span>
        <span className="text-right text-ocean-600">
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
        className="w-full accent-ocean-600 disabled:opacity-40"
        aria-label="Select hour"
      />
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>{hasHours ? formatSydneyDateTime(hours[0]) : "—"}</span>
        <span>{hasHours ? formatSydneyDateTime(hours[hours.length - 1]) : "—"}</span>
      </div>
    </div>
  );
}
