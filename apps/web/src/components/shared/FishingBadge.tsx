import type { FishingTier } from "@/lib/types";

const TIER_CLASSES: Record<FishingTier, string> = {
  poor: "bg-slate-100 text-slate-600 border-slate-300",
  fair: "bg-sky-100 text-sky-800 border-sky-300",
  good: "bg-teal-100 text-teal-800 border-teal-300",
  great: "bg-indigo-100 text-indigo-800 border-indigo-300",
};

const TIER_LABELS: Record<FishingTier, string> = {
  poor: "\u{1F3A3} Poor",
  fair: "\u{1F3A3} Fair",
  good: "\u{1F3A3} Good",
  great: "\u{1F3A3} Great",
};

/** Small colored badge for a FishingTier — how much swell/tide is pushing
 * directly onto this ledge right now, independent of the DangerBadge's
 * safety read. `null` means no data for the hour. */
export function FishingBadge({ tier }: { tier: FishingTier | null }) {
  if (tier === null) {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
        No data
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TIER_CLASSES[tier]}`}
    >
      {TIER_LABELS[tier]}
    </span>
  );
}
