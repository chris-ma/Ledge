import { pressureToHeatColor } from "@/lib/colorScale";

// A smooth blend across the same blue->green->yellow->red scale
// PressureHeatmap colors each ledge's marker from, rather than reading as
// separate discrete colour bands.
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

        {/* The danger flags are a separate reading from the colour beneath
            them — best fishing and worst safety often coincide on a rock
            ledge — so the key states that rather than letting the two scales
            look like one. */}
        <div className="mt-2 border-t border-white/10 pt-2">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
            <FlagSwatch fill="#f59e0b" />
            <span>Caution</span>
            <FlagSwatch fill="#dc2626" />
            <span>Dangerous</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400">Wave runup — not a fishing rating</div>
        </div>
      </div>
    </div>
  );
}

function FlagSwatch({ fill }: { fill: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 22V3" stroke="#e2e8f0" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M7 3.5h11.5l-3 4 3 4H7z" fill={fill} stroke="#e2e8f0" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}
