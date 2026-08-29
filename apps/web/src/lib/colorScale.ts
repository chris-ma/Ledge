// Sequential LLI (0-100) -> color scale, pale blue/green -> intense
// orange/red, plus a distinct grey for null (which must NEVER read as "0" —
// it means "no data for this hour", not "no load").

import type { CSSProperties } from "react";

interface ColorStop {
  value: number;
  rgb: readonly [number, number, number];
}

const STOPS: readonly ColorStop[] = [
  { value: 0, rgb: [224, 242, 241] }, // pale aqua
  { value: 25, rgb: [163, 216, 178] }, // pale green
  { value: 50, rgb: [250, 210, 100] }, // amber
  { value: 75, rgb: [244, 140, 70] }, // orange
  { value: 100, rgb: [214, 40, 40] }, // intense red
];

/** Distinct grey for `lli === null` — deliberately not on the 0-100 gradient above. */
export const NULL_LLI_COLOR = "#9ca3af"; // slate-400

/** Diagonal hatch layered on top of the LLI fill color for caution/dangerous hours — a mechanism independent of the color scale. */
export const DANGER_HATCH_BACKGROUND =
  "repeating-linear-gradient(45deg, rgba(127,29,29,0.6) 0, rgba(127,29,29,0.6) 2px, transparent 2px, transparent 6px)";

export const DANGER_BORDER_CLASS = "border-2 border-red-600";

/** Inline style fragment combining the hatch + fill, for callers that need it as a single style object (e.g. legend swatches). */
export function dangerHatchStyle(lli: number | null): CSSProperties {
  return {
    backgroundColor: lliToColor(lli),
    backgroundImage: DANGER_HATCH_BACKGROUND,
  };
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/** Interpolates an [r,g,b] triple at `value` across a sorted ColorStop list. */
function interpolateStops(stops: readonly ColorStop[], value: number): readonly [number, number, number] {
  let lower: ColorStop = stops[0];
  let upper: ColorStop = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (value >= stops[i].value && value <= stops[i + 1].value) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }
  const range = upper.value - lower.value || 1;
  const t = (value - lower.value) / range;
  return [
    lerp(lower.rgb[0], upper.rgb[0], t),
    lerp(lower.rgb[1], upper.rgb[1], t),
    lerp(lower.rgb[2], upper.rgb[2], t),
  ];
}

export function lliToColor(lli: number | null): string {
  if (lli === null || Number.isNaN(lli)) return NULL_LLI_COLOR;
  const clamped = Math.min(100, Math.max(0, lli));
  const [r, g, b] = interpolateStops(STOPS, clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Evenly-spaced sample values for rendering a legend gradient swatch. */
export const LEGEND_STOPS: readonly number[] = [0, 25, 50, 75, 100];

// Fishing Pressure Index (0-100) -> a blue-to-red "thermal" gradient for the
// map's pressure glow layer — deliberately a different palette from the LLI
// scale above, so the two visual channels (danger-oriented LLI dot fill,
// opportunity-oriented pressure glow) read as clearly distinct at a glance.
const PRESSURE_HEAT_STOPS: readonly ColorStop[] = [
  { value: 0, rgb: [59, 130, 246] }, // blue-500, cold/calm
  { value: 33, rgb: [34, 197, 94] }, // green-500
  { value: 66, rgb: [234, 179, 8] }, // yellow-500
  { value: 100, rgb: [239, 68, 68] }, // red-500, hot
];

function toHex(n: number): string {
  return n.toString(16).padStart(2, "0");
}

/** Fishing Pressure Index (0-100) -> hex color on the blue->red heat gradient. */
export function pressureToHeatColor(pressure: number): string {
  const clamped = Math.min(100, Math.max(0, pressure));
  const [r, g, b] = interpolateStops(PRESSURE_HEAT_STOPS, clamped);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Evenly-spaced sample values for rendering the pressure legend gradient. */
export const PRESSURE_LEGEND_STOPS: readonly number[] = [0, 33, 66, 100];
