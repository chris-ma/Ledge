import {
  DANGER_BORDER_CLASS,
  DANGER_HATCH_BACKGROUND,
  NULL_DATA_COLOR,
  PRESSURE_LEGEND_STOPS,
  pressureToHeatColor,
} from "@/lib/colorScale";

/** Explains the Fishing Condition color scale, the null/no-data grey, and the danger hatch. */
export function HeatmapLegend() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm">
      <div>
        <div className="mb-1 font-medium text-slate-700">Fishing Condition</div>
        <div className="flex items-center gap-2">
          <span>0</span>
          <div className="flex h-4 flex-1 overflow-hidden rounded">
            {PRESSURE_LEGEND_STOPS.map((stop) => (
              <div key={stop} className="h-full flex-1" style={{ backgroundColor: pressureToHeatColor(stop) }} />
            ))}
          </div>
          <span>100</span>
        </div>
        <div className="mt-1 text-[11px] text-slate-500">
          Red = ideal — more swell/tide pushing onto the ledge right now. Shown as colored cells on a ledge's page.
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-sm border border-slate-300"
            style={{ backgroundColor: NULL_DATA_COLOR }}
          />
          <span>No data for this hour (never treated as 0)</span>
        </div>
      </div>
      <div className="border-t border-slate-100 pt-2">
        <div className="mb-1 font-medium text-slate-700">Danger flag</div>
        <div className="flex items-center gap-2">
          <span
            className={`h-4 w-4 shrink-0 rounded-sm ${DANGER_BORDER_CLASS}`}
            style={{ backgroundColor: pressureToHeatColor(60), backgroundImage: DANGER_HATCH_BACKGROUND }}
          />
          <span>Caution / dangerous hour (wave-runup estimate) — independent of the fishing condition colour</span>
        </div>
      </div>
    </div>
  );
}
