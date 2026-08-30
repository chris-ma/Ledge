import { DANGER_HATCH_BACKGROUND, PRESSURE_LEGEND_STOPS, pressureToHeatColor } from "@/lib/colorScale";

/**
 * The Fishing Condition color-scale key, floating over the map's top-right
 * corner — same dark glass-card language as HourSlider below it (blurred
 * dark background, subtle border) rather than the light sidebar card
 * HeatmapLegend uses on the ledge detail page.
 */
export function MapLegend() {
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[1000]">
      <div className="pointer-events-auto flex w-48 flex-col gap-2 rounded-2xl border border-white/10 bg-slate-900/75 px-4 py-3 text-white shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Fishing Condition
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
            <span>0</span>
            <div className="flex h-2.5 flex-1 overflow-hidden rounded-full">
              {PRESSURE_LEGEND_STOPS.map((stop) => (
                <div key={stop} className="h-full flex-1" style={{ backgroundColor: pressureToHeatColor(stop) }} />
              ))}
            </div>
            <span>100</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400">Red = ideal right now</div>
        </div>
        <div className="flex items-center gap-2 border-t border-white/10 pt-2">
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-sm border-2 border-red-500"
            style={{ backgroundColor: pressureToHeatColor(60), backgroundImage: DANGER_HATCH_BACKGROUND }}
          />
          <span className="text-[10px] text-slate-300">Caution / dangerous</span>
        </div>
      </div>
    </div>
  );
}
