import { DANGER_BORDER_CLASS, DANGER_HATCH_BACKGROUND, LEGEND_STOPS, NULL_LLI_COLOR, lliToColor } from "@/lib/colorScale";

/** Explains the LLI color scale, the null/no-data grey, and the danger hatch. */
export function HeatmapLegend() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm">
      <div>
        <div className="mb-1 font-medium text-slate-700">Ledge Load Index (LLI)</div>
        <div className="flex items-center gap-2">
          <span>0</span>
          <div className="flex h-4 flex-1 overflow-hidden rounded">
            {LEGEND_STOPS.map((stop) => (
              <div key={stop} className="h-full flex-1" style={{ backgroundColor: lliToColor(stop) }} />
            ))}
          </div>
          <span>100</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-sm border border-slate-300"
            style={{ backgroundColor: NULL_LLI_COLOR }}
          />
          <span>No data for this hour (never treated as 0 load)</span>
        </div>
      </div>
      <div className="border-t border-slate-100 pt-2">
        <div className="mb-1 font-medium text-slate-700">Danger flag</div>
        <div className="flex items-center gap-2">
          <span
            className={`h-4 w-4 shrink-0 rounded-sm ${DANGER_BORDER_CLASS}`}
            style={{ backgroundColor: lliToColor(60), backgroundImage: DANGER_HATCH_BACKGROUND }}
          />
          <span>Caution / dangerous hour (wave-runup estimate) — independent of the LLI colour</span>
        </div>
      </div>
    </div>
  );
}
