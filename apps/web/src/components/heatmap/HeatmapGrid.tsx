import { formatSydneyDayLabel, getSortedDayKeys, groupConditionsBySydneyDay } from "@/lib/time";
import type { LedgeCondition } from "@/lib/types";
import { HeatmapCell } from "./HeatmapCell";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

/**
 * Day rows x 24 hour columns (GitHub-contribution-graph visual language) for
 * one ledge's hourly series. The backend's fetch window is UTC-day-anchored,
 * so the first/last Sydney-local day may have fewer than 24 populated hours
 * — HeatmapCell renders those as empty/grey without misaligning columns,
 * since we always iterate the fixed 0-23 hour range per row.
 */
export function HeatmapGrid({ conditions }: { conditions: LedgeCondition[] }) {
  const byDay = groupConditionsBySydneyDay(conditions);
  const dayKeys = getSortedDayKeys(byDay);

  if (dayKeys.length === 0) {
    return <p className="text-sm text-slate-500">No condition data for this window yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="sticky left-0 bg-slate-50" aria-hidden="true" />
            {HOURS.map((hour) => (
              <th
                key={hour}
                className="w-5 text-center text-[10px] font-normal text-slate-400"
                scope="col"
              >
                {hour % 3 === 0 ? hour : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dayKeys.map((dayKey) => {
            const hourMap = byDay.get(dayKey);
            return (
              <tr key={dayKey}>
                <th
                  scope="row"
                  className="sticky left-0 whitespace-nowrap bg-slate-50 pr-2 text-right text-xs font-medium text-slate-600"
                >
                  {formatSydneyDayLabel(dayKey)}
                </th>
                {HOURS.map((hour) => (
                  <td key={hour} className="p-0">
                    <HeatmapCell condition={hourMap?.get(hour) ?? null} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
