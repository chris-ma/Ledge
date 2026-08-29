import { DANGER_BORDER_CLASS, DANGER_HATCH_BACKGROUND, fishingConditionColor } from "@/lib/colorScale";
import { formatSydneyDateTime } from "@/lib/time";
import type { LedgeCondition } from "@/lib/types";

function formatValue(value: number | null, unit: string, digits = 1): string {
  return value === null ? "no data" : `${value.toFixed(digits)}${unit}`;
}

/** Tooltip text for one hour's condition — shared with NowTimeline's cells. */
export function buildConditionTooltip(condition: LedgeCondition): string {
  return [
    formatSydneyDateTime(condition.ts),
    `Fishing condition: ${condition.fishingPressure === null ? "no data" : Math.round(condition.fishingPressure)}`,
    `Hs: ${formatValue(condition.hsM, "m")}`,
    `Tp: ${formatValue(condition.tpS, "s")}`,
    `Tide: ${formatValue(condition.tideHeightCm, "cm", 0)}`,
    `Danger tier: ${condition.dangerTier ?? "no data"}`,
  ].join("\n");
}

/**
 * One hour's cell in the heat map grid. Fill color always comes from the
 * Fishing Condition color scale (red = ideal; grey for null, never treated
 * as "0"). A non-normal danger tier layers a red border + diagonal hatch ON
 * TOP of that fill — a mechanism kept independent of the color scale, so
 * "great fishing condition + dangerous" reads differently from "great
 * condition, not dangerous" and from "poor condition + dangerous".
 */
export function HeatmapCell({ condition }: { condition: LedgeCondition | null }) {
  if (!condition) {
    // Hour not present in the fetched window at all (partial first/last
    // Sydney day) — distinct, lighter treatment from a populated-but-null cell.
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
        backgroundColor: fishingConditionColor(condition.fishingPressure),
        backgroundImage: isDangerLike ? DANGER_HATCH_BACKGROUND : undefined,
      }}
      title={buildConditionTooltip(condition)}
    />
  );
}
