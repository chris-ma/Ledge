// Distinct grey for a null metric value (which must NEVER read as "0" — it
// means "no data for this hour", not "no load"/"no pressure").

interface ColorStop {
  value: number;
  rgb: readonly [number, number, number];
}

export const NULL_DATA_COLOR = "#9ca3af"; // slate-400

/** Diagonal hatch layered on top of a cell's fill color for caution/dangerous hours — a mechanism independent of the color scale. */
export const DANGER_HATCH_BACKGROUND =
  "repeating-linear-gradient(45deg, rgba(127,29,29,0.6) 0, rgba(127,29,29,0.6) 2px, transparent 2px, transparent 6px)";

export const DANGER_BORDER_CLASS = "border-2 border-red-600";

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

// Fishing Condition = the Fishing Pressure Index (0-100) rendered as a
// blue-to-red "thermal" gradient — red is deliberately the ideal/most
// promising end (heaviest swell+tide push onto the ledge), used everywhere
// this score is shown: grid cells, the map's heat zones, and tooltips.
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

/** Null-aware Fishing Condition color for a single cell/marker — grey for "no data", never treated as 0. */
export function fishingConditionColor(fishingPressure: number | null): string {
  if (fishingPressure === null || Number.isNaN(fishingPressure)) return NULL_DATA_COLOR;
  return pressureToHeatColor(fishingPressure);
}

/** Evenly-spaced sample values for rendering the pressure legend gradient. */
export const PRESSURE_LEGEND_STOPS: readonly number[] = [0, 33, 66, 100];
