import { pressureToHeatColor } from "@/lib/colorScale";

// Same stops as PressureHeatmap's own gradient (0/33/66/100), so the key's
// blend genuinely mimics the heat layer's smooth blue->green->yellow->red
// falloff rather than reading as separate colour bands.
const GRADIENT_CSS = `linear-gradient(to right, ${pressureToHeatColor(0)}, ${pressureToHeatColor(33)}, ${pressureToHeatColor(66)}, ${pressureToHeatColor(100)})`;

/**
 * The Fishing Condition color-scale key, floating over the map's top-right
 * corner — same dark glass-card language as HourSlider below it, but fully
 * opaque (not translucent) so it stays legible over any zone colour behind it.
 */
export function MapLegend() {
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[1000]">
      <div className="pointer-events-auto w-48 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white shadow-2xl shadow-black/40">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
          Fishing Condition
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
          <span>0</span>
          <div className="h-2.5 flex-1 rounded-full" style={{ background: GRADIENT_CSS }} />
          <span>100</span>
        </div>
        <div className="mt-1 text-[10px] text-slate-400">Red = ideal right now</div>
      </div>
    </div>
  );
}
