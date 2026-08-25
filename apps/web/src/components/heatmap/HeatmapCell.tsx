import { DANGER_BORDER_CLASS, DANGER_HATCH_BACKGROUND, lliToColor } from "@/lib/colorScale";
import { formatSydneyDateTime } from "@/lib/time";
import type { LedgeCondition } from "@/lib/types";

function formatValue(value: number | null, unit: string, digits = 1): string {
  return value === null ? "no data" : `${value.toFixed(digits)}${unit}`;
}

function buildTitle(condition: LedgeCondition): string {
  return [
    formatSydneyDateTime(condition.ts),
    `LLI: ${condition.lli === null ? "no data" : Math.round(condition.lli)}`,
    `Hs: ${formatValue(condition.hsM, "m")}`,
    `Tp: ${formatValue(condition.tpS, "s")}`,
    `Tide: ${formatValue(condition.tideHeightCm, "cm", 0)}`,
    `Danger tier: ${condition.dangerTier ?? "no data"}`,
  ].join("\n");
}

/**
 * One hour's cell in the heat map grid. Fill color always comes from the LLI
 * color scale (grey for null, never treated as "0"). A non-normal danger
 * tier layers a red border + diagonal hatch ON TOP of that fill — a
 * mechanism kept independent of the color scale, so "high LLI + dangerous"
 * reads differently from "high LLI, not dangerous" and from "low LLI +
 * dangerous".
 */
export function HeatmapCell({ condition }: { condition: LedgeCondition | null }) {
  if (!condition) {
    // Hour not present in the fetched window at all (partial first/last
    // Sydney day) — distinct, lighter treatment from a populated-but-null-LLI cell.
    return (
      <div
        className="h-5 w-5 rounded-sm border border-dashed border-slate-200 bg-slate-100"
        title="No data for this hour"
      />
    );
  }

  const isDangerLike = condition.dangerTier !== null && condition.dangerTier !== "normal";

  return (
    <div
      className={`h-5 w-5 rounded-sm ${isDangerLike ? DANGER_BORDER_CLASS : ""}`}
      style={{
        backgroundColor: lliToColor(condition.lli),
        backgroundImage: isDangerLike ? DANGER_HATCH_BACKGROUND : undefined,
      }}
      title={buildTitle(condition)}
    />
  );
}
