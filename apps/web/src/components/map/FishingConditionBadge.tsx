import { useNavigate } from "react-router-dom";
import { FISHING_TIER_LABELS } from "@/components/shared/FishingBadge";
import type { FishingTier, Ledge, LedgeCondition } from "@/lib/types";

interface FishingConditionBadgeProps {
  ledges: Ledge[];
  /** condition at the currently-selected hour, keyed by ledgeId. */
  conditionsByLedgeId: Map<string, LedgeCondition>;
}

// A solid (not pale) fill per tier, strong enough for white text to stay
// legible floating over the map — same hue family as FishingBadge's pale
// pills, just a bold shade instead.
const TIER_BADGE_BG: Record<FishingTier, string> = {
  poor: "bg-slate-500",
  fair: "bg-sky-500",
  good: "bg-teal-500",
  great: "bg-indigo-600",
};

function pickBestLedge(
  ledges: Ledge[],
  conditionsByLedgeId: Map<string, LedgeCondition>,
): { ledge: Ledge; condition: LedgeCondition } | null {
  let best: { ledge: Ledge; condition: LedgeCondition } | null = null;
  for (const ledge of ledges) {
    const condition = conditionsByLedgeId.get(ledge.id);
    if (!condition || condition.fishingPressure === null) continue;
    if (best === null || condition.fishingPressure > (best.condition.fishingPressure as number)) {
      best = { ledge, condition };
    }
  }
  return best;
}

/**
 * A single plain-word "is fishing good right now" read, floating over the
 * map's top-right corner — no heat-zone color scale to interpret. Shows
 * whichever ledge currently has the highest Fishing Pressure and its tier
 * as a big word (Poor/Fair/Good/Great), not a number. Tapping it jumps to
 * that ledge's detail page.
 */
export function FishingConditionBadge({ ledges, conditionsByLedgeId }: FishingConditionBadgeProps) {
  const navigate = useNavigate();
  const best = pickBestLedge(ledges, conditionsByLedgeId);
  const tier = best?.condition.fishingTier ?? null;

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[1000]">
      {tier === null || best === null ? (
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-slate-900/75 px-4 py-2.5 text-right text-white shadow-xl backdrop-blur-xl">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Fishing right now</div>
          <div className="text-sm font-semibold text-slate-300">No data</div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => navigate(`/ledges/${best.ledge.id}`)}
          className={`pointer-events-auto flex flex-col items-end rounded-2xl border border-white/20 px-4 py-2.5 text-right text-white shadow-xl transition hover:brightness-110 ${TIER_BADGE_BG[tier]}`}
        >
          <span className="text-[10px] font-medium uppercase tracking-wide text-white/80">Fishing right now</span>
          <span className="text-base font-bold leading-tight">{FISHING_TIER_LABELS[tier]}</span>
          <span className="text-[11px] font-medium text-white/85">{best.ledge.name}</span>
        </button>
      )}
    </div>
  );
}
