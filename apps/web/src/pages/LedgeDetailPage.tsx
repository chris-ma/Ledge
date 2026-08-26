import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { AttributionFooter } from "@/components/shared/AttributionFooter";
import { DangerBadge } from "@/components/shared/DangerBadge";
import { DisclaimerBanner } from "@/components/shared/DisclaimerBanner";
import { FishingBadge } from "@/components/shared/FishingBadge";
import { UnverifiedBadge } from "@/components/shared/UnverifiedBadge";
import { HeatmapGrid } from "@/components/heatmap/HeatmapGrid";
import { HeatmapLegend } from "@/components/heatmap/HeatmapLegend";
import { useLedgeConditions } from "@/hooks/useLedgeConditions";
import { useLedges } from "@/hooks/useLedges";
import { findDefaultHourIndex, getDefaultWindowIso, getUniqueSortedTimestamps } from "@/lib/time";

export function LedgeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { fromIso, toIso } = useMemo(() => getDefaultWindowIso(), []);

  const ledgesQuery = useLedges();
  const conditionsQuery = useLedgeConditions(id ?? "", fromIso, toIso);

  const ledge = ledgesQuery.data?.find((l) => l.id === id);

  // Current-hour snapshot for the header badge — same "closest to now" logic the map's HourSlider defaults to.
  const currentCondition = useMemo(() => {
    const data = conditionsQuery.data;
    if (!data || data.length === 0) return undefined;
    const hours = getUniqueSortedTimestamps(data);
    const ts = hours[findDefaultHourIndex(hours)];
    return data.find((c) => c.ts === ts);
  }, [conditionsQuery.data]);

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
              <HeatmapGrid conditions={conditionsQuery.data} />
              <HeatmapLegend />
            </>
          )}
        </div>
      </div>

      <AttributionFooter />
    </div>
  );
}
