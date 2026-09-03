import { useMemo, useState } from "react";
import { pressureToHeatColor } from "@/lib/colorScale";
import { getMoonPhase } from "@/lib/moonPhase";

// A smooth blend across the same blue->green->yellow->red scale
// PressureHeatmap colors each ledge's marker from, rather than reading as
// separate discrete colour bands.
const GRADIENT_CSS = `linear-gradient(to right, ${pressureToHeatColor(0)}, ${pressureToHeatColor(33)}, ${pressureToHeatColor(66)}, ${pressureToHeatColor(100)})`;

interface MapLegendProps {
  /** ISO 8601 instant to compute the moon phase for — the map's currently selected hour, falling back to now. */
  ts?: string;
}

/**
 * The Fishing Condition color-scale key, floating over the map's top-right
 * corner — same dark glass-card language as HourSlider below it, but fully
 * opaque (not translucent) so it stays legible over any zone colour behind it.
 * Collapsible: the header (with the moon phase, which stays visible either
 * way) toggles the rest of the key open/closed.
 */
export function MapLegend({ ts }: MapLegendProps) {
  const [open, setOpen] = useState(true);
  const moon = useMemo(() => getMoonPhase(ts ? new Date(ts) : new Date()), [ts]);

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[1000]">
      <div className="pointer-events-auto w-48 rounded-2xl border border-white/10 bg-slate-900 text-white shadow-2xl shadow-black/40">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        >
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Legend</span>
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-slate-300">
              <span>{moon.emoji}</span>
              <span>{Math.round(moon.illumination * 100)}%</span>
            </span>
            <ChevronIcon open={open} />
          </span>
        </button>

        {open && (
          <div className="px-4 pb-3">
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

            <div className="mt-2 border-t border-white/10 pt-2">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
                <LineSwatch color="#22c55e" />
                <span>&lt;10kt</span>
                <LineSwatch color="#eab308" />
                <span>10-15kt</span>
                <LineSwatch color="#ef4444" />
                <span>&gt;15kt</span>
              </div>
              <div className="mt-1 text-[10px] text-slate-400">Wind (10m)</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LineSwatch({ color }: { color: string }) {
  return <div className="h-1 w-3 rounded-full" style={{ backgroundColor: color }} />;
}

function FlagSwatch({ fill }: { fill: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 22V3" stroke="#e2e8f0" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M7 3.5h11.5l-3 4 3 4H7z" fill={fill} stroke="#e2e8f0" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}
