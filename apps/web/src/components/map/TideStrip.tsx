import { tideTrend, type TidePoint } from "@/lib/tide";

interface TideStripProps {
  tideSeries: TidePoint[];
  index: number;
}

const SVG_WIDTH = 100;
const SVG_HEIGHT = 28;
const Y_PADDING = 3;

interface Paths {
  linePath: string;
  areaPath: string;
}

/** Builds an area-sparkline path across the fetched window — null points (no data for that hour) are simply skipped, not interpolated as 0. */
function buildPaths(series: TidePoint[]): Paths | null {
  const points = series
    .map((p, i) => (p.heightCm === null ? null : { i, h: p.heightCm }))
    .filter((p): p is { i: number; h: number } => p !== null);
  if (points.length < 2) return null;

  const heights = points.map((p) => p.h);
  const min = Math.min(...heights);
  const max = Math.max(...heights);
  const range = max - min || 1;
  const n = series.length;

  const coords = points.map(({ i, h }) => {
    const x = (i / Math.max(n - 1, 1)) * SVG_WIDTH;
    const y = SVG_HEIGHT - Y_PADDING - ((h - min) / range) * (SVG_HEIGHT - Y_PADDING * 2);
    return [x, y] as const;
  });

  const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const [firstX] = coords[0];
  const [lastX] = coords[coords.length - 1];
  const areaPath = `${linePath} L${lastX.toFixed(2)},${SVG_HEIGHT} L${firstX.toFixed(2)},${SVG_HEIGHT} Z`;

  return { linePath, areaPath };
}

const TREND_ARROW: Record<string, string> = { rising: "↑", falling: "↓", steady: "→" };
const TREND_LABEL: Record<string, string> = { rising: "Rising", falling: "Falling", steady: "Steady" };

/**
 * A tide sparkline + readout docked underneath HourSlider's range input,
 * sharing its exact 0-100% x-axis so the marker line lines up with the
 * slider thumb above it — scrubbing the hour visibly moves both together.
 */
export function TideStrip({ tideSeries, index }: TideStripProps) {
  const current = tideSeries[index];
  const trend = current ? tideTrend(current.rateCmPerHr) : null;
  const paths = buildPaths(tideSeries);
  const hasCurrent = current?.heightCm !== null && current?.heightCm !== undefined;
  const markerPct = tideSeries.length > 1 ? (index / (tideSeries.length - 1)) * 100 : 0;

  return (
    <div className="flex flex-col gap-1 border-t border-white/10 pt-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Tide</span>
        <span className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-ocean-300">
          {hasCurrent ? `${Math.round(current!.heightCm as number)}cm` : "No data"}
          {trend && (
            <span className="text-xs font-medium text-slate-300">
              {TREND_ARROW[trend]} {TREND_LABEL[trend]}
            </span>
          )}
        </span>
      </div>
      <div className="relative h-7 w-full">
        {paths ? (
          <>
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              preserveAspectRatio="none"
              className="h-full w-full overflow-visible"
            >
              <defs>
                <linearGradient id="tideFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4fa9c9" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#4fa9c9" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={paths.areaPath} fill="url(#tideFill)" />
              <path
                d={paths.linePath}
                fill="none"
                stroke="#7cc4dc"
                strokeWidth="1.2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div
              className="pointer-events-none absolute top-0 h-full w-px bg-white/50"
              style={{ left: `${markerPct}%` }}
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-slate-500">
            No tide data for this window
          </div>
        )}
      </div>
    </div>
  );
}
