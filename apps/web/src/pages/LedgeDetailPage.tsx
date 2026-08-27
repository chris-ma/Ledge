import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { AttributionFooter } from "@/components/shared/AttributionFooter";
import { DANGER_TIER_CLASSES, DANGER_TIER_LABELS, DangerBadge } from "@/components/shared/DangerBadge";
import { DisclaimerBanner } from "@/components/shared/DisclaimerBanner";
import { FISHING_TIER_CLASSES, FISHING_TIER_LABELS, FishingBadge } from "@/components/shared/FishingBadge";
import { UnverifiedBadge } from "@/components/shared/UnverifiedBadge";
import { HeatmapGrid } from "@/components/heatmap/HeatmapGrid";
import { HeatmapLegend } from "@/components/heatmap/HeatmapLegend";
import { NowTimeline, TIMELINE_HOURS_BACK } from "@/components/timeline/NowTimeline";
import { WindowSummaryList } from "@/components/timeline/WindowSummaryList";
import { useLedgeConditions } from "@/hooks/useLedgeConditions";
import { useLedges } from "@/hooks/useLedges";
import {
  findDefaultHourIndex,
  getDefaultWindowIso,
  getUniqueSortedTimestamps,
  nowHourIso,
} from "@/lib/time";
import type { DangerTier, FishingTier, LedgeCondition } from "@/lib/types";
import { filterUpcomingWindows, summarizeTierWindows } from "@/lib/windows";

const DANGER_NOTABLE_TIERS = new Set<DangerTier>(["caution", "dangerous"]);
const BITE_NOTABLE_TIERS = new Set<FishingTier>(["good", "great"]);

export function LedgeDetailPage() {
  const { id } = useParams<{ id: string }>();
  // hoursBack extends the fetch window into the past so the now-timeline has
  // real elapsed hours to show to the left of "now", not just forecast.
  const { fromIso, toIso } = useMemo(() => getDefaultWindowIso(undefined, TIMELINE_HOURS_BACK), []);

  const ledgesQuery = useLedges();
  const conditionsQuery = useLedgeConditions(id ?? "", fromIso, toIso);
  const conditions: LedgeCondition[] = conditionsQuery.data ?? [];

  const ledge = ledgesQuery.data?.find((l) => l.id === id);

  // Current-hour snapshot for the header badge — same "closest to now" logic the map's HourSlider defaults to.
  const currentCondition = useMemo(() => {
    if (conditions.length === 0) return undefined;
    const hours = getUniqueSortedTimestamps(conditions);
    const ts = hours[findDefaultHourIndex(hours)];
    return conditions.find((c) => c.ts === ts);
  }, [conditions]);

  const dangerWindows = useMemo(() => {
    const windows = summarizeTierWindows(conditions, (c) => c.dangerTier, DANGER_NOTABLE_TIERS);
    return filterUpcomingWindows(windows, nowHourIso());
  }, [conditions]);

  const biteWindows = useMemo(() => {
    const windows = summarizeTierWindows(conditions, (c) => c.fishingTier, BITE_NOTABLE_TIERS);
    return filterUpcomingWindows(windows, nowHourIso());
  }, [conditions]);

  return (
    <div className="flex h-full flex-col">
      <DisclaimerBanner />

      <div className="flex-1 overflow-y-auto p-4">
        <Link to="/" className="text-sm text-ocean-600 hover:underline">
          &larr; Back to map
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {ledge?.name ?? (ledgesQuery.isLoading ? "Loading…" : "Unknown ledge")}
            </h1>
            {ledge && <p className="text-sm text-slate-500">{ledge.area}</p>}
          </div>
          {ledge && !ledge.heightVerified && <UnverifiedBadge />}
          {currentCondition && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span>Current hour:</span>
              <DangerBadge tier={currentCondition.dangerTier} />
              <FishingBadge tier={currentCondition.fishingTier} />
              <span>
                LLI {currentCondition.lli === null ? "no data" : Math.round(currentCondition.lli)}
              </span>
            </div>
          )}
        </div>

        {ledge?.isDeclaredHazard && (
          <p className="mt-3 inline-block rounded border border-red-300 bg-red-50 px-2 py-1 text-sm text-red-800">
            Declared hazardous rock-fishing location (NSW).
          </p>
        )}

        {ledge?.notes && <p className="mt-3 max-w-2xl text-sm text-slate-600">{ledge.notes}</p>}

        {ledgesQuery.isError && (
          <p className="mt-3 text-sm text-red-700">
            Couldn&rsquo;t load ledge details. The API may not be live yet.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-4">
          {conditionsQuery.isLoading && (
            <p className="text-sm text-slate-500">Loading hourly conditions…</p>
          )}
          {conditionsQuery.isError && (
            <p className="text-sm text-red-700">
              Couldn&rsquo;t load conditions for this ledge. The API may not be live yet.
            </p>
          )}
          {conditionsQuery.data && (
            <>
              <NowTimeline conditions={conditions} />

              <div className="grid gap-4 sm:grid-cols-2">
                <WindowSummaryList
                  title="Dangerous times ahead"
                  icon="⚠️"
                  windows={dangerWindows}
                  tierLabels={DANGER_TIER_LABELS}
                  tierClasses={DANGER_TIER_CLASSES}
                  emptyMessage="No caution/dangerous hours forecast in this window."
                />
                <WindowSummaryList
                  title="Best bite windows ahead"
                  icon="🎣"
                  windows={biteWindows}
                  tierLabels={FISHING_TIER_LABELS}
                  tierClasses={FISHING_TIER_CLASSES}
                  emptyMessage="No standout fishing-pressure windows forecast yet."
                />
              </div>

              <div className="mt-2">
                <h2 className="mb-2 text-sm font-semibold text-slate-700">Full 10-day forecast</h2>
                <div className="flex flex-col gap-4">
                  <HeatmapGrid conditions={conditions} />
                  <HeatmapLegend />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <AttributionFooter />
    </div>
  );
}
