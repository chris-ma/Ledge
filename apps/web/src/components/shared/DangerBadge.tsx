import type { DangerTier } from "@/lib/types";

/** Exported for reuse anywhere else a DangerTier needs the same colour language (e.g. WindowSummaryList). */
export const DANGER_TIER_CLASSES: Record<DangerTier, string> = {
  normal: "bg-emerald-100 text-emerald-800 border-emerald-300",
  caution: "bg-amber-100 text-amber-800 border-amber-300",
  dangerous: "bg-red-100 text-red-800 border-red-300",
};

export const DANGER_TIER_LABELS: Record<DangerTier, string> = {
  normal: "\u{1F7E2} Normal",
  caution: "\u{1F7E1} Caution",
  dangerous: "\u{1F534} Dangerous",
};

/** Small colored badge for a DangerTier, matching the spec's own tier language. `null` means no data for the hour. */
export function DangerBadge({ tier }: { tier: DangerTier | null }) {
  if (tier === null) {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
        No data
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${DANGER_TIER_CLASSES[tier]}`}
    >
      {DANGER_TIER_LABELS[tier]}
    </span>
  );
}
