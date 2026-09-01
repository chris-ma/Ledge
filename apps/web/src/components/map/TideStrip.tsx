import { tideTrend, type TidePoint } from "@/lib/tide";

const SVG_WIDTH = 100;
const SVG_HEIGHT = 40;
const Y_PADDING = 6;

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

/** Plain-text tide reading for the current hour — "62cm ↑ Rising", or "No data". Used in HourSlider's footer row. */
export function formatTideReading(tideSeries: TidePoint[], index: number): string {
  const current = tideSeries[index];
  if (!current || current.heightCm === null) return "No tide data";
  const trend = tideTrend(current.rateCmPerHr);
  const trendText = trend ? ` ${TREND_ARROW[trend]} ${TREND_LABEL[trend]}` : "";
  return `${Math.round(current.heightCm)}cm${trendText}`;
}

/**
 * A translucent tide-height sparkline, absolutely positioned to fill its
 * parent — meant to sit visually BEHIND HourSlider's range input as a
 * backdrop, not as its own separate section. Shares the slider's exact
 * 0-100% x-axis, so the thumb scrubbing across it lines up with wherever
 * "now" sits in the tide cycle.
 *
 * `from`/`to` clip it to the hours the slider is currently showing: the
 * slider spans three days out of a ten-day series, so drawing the whole
 * series here would put the curve badly out of step with the thumb.
 */
export function TideBackdrop({
  tideSeries,
  from = 0,
  to = tideSeries.length - 1,
}: {
  tideSeries: TidePoint[];
  from?: number;
  to?: number;
}) {
  const paths = buildPaths(tideSeries.slice(from, to + 1));
  if (!paths) return null;

  return (
    <svg
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
    >
      <defs>
        <linearGradient id="tideFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4fa9c9" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#4fa9c9" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d={paths.areaPath} fill="url(#tideFill)" />
      <path d={paths.linePath} fill="none" stroke="#7cc4dc" strokeWidth="1.2" strokeOpacity="0.7" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
