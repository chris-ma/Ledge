import { addHoursIso, formatSydneyDateTime } from "@/lib/time";
import type { TierWindow } from "@/lib/windows";

interface WindowSummaryListProps<T extends string> {
  title: string;
  icon: string;
  windows: TierWindow<T>[];
  tierLabels: Record<T, string>;
  tierClasses: Record<T, string>;
  emptyMessage: string;
}

/**
 * Plain-language summary of upcoming windows (dangerous hours, best-bite
 * hours) — a merged run of hours sharing a notable tier, rendered as one
 * line each, rather than making the reader scan a dense per-hour grid for
 * the same information. Generic over the tier type so the same component
 * serves both DangerTier and FishingTier windows.
 */
export function WindowSummaryList<T extends string>({
  title,
  icon,
  windows,
  tierLabels,
  tierClasses,
  emptyMessage,
}: WindowSummaryListProps<T>) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="mb-2 text-sm font-medium text-slate-700">
        {icon} {title}
      </div>
      {windows.length === 0 ? (
        <p className="text-xs text-slate-500">{emptyMessage}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {windows.map((w) => (
            <li key={`${w.startTs}-${w.tier}`} className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${tierClasses[w.tier]}`}
              >
                {tierLabels[w.tier]}
              </span>
              <span>
                {formatSydneyDateTime(w.startTs)} &ndash; {formatSydneyDateTime(addHoursIso(w.endTs, 1))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
