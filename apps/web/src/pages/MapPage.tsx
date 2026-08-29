import { useMemo, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import { AttributionFooter } from "@/components/shared/AttributionFooter";
import { DisclaimerBanner } from "@/components/shared/DisclaimerBanner";
import { HeatmapLegend } from "@/components/heatmap/HeatmapLegend";
import { HourSlider } from "@/components/map/HourSlider";
import { LedgeMarkers } from "@/components/map/LedgeMarkers";
import { PressureGlow } from "@/components/map/PressureGlow";
import { useConditionsAtRange } from "@/hooks/useConditionsAtRange";
import { useLedges } from "@/hooks/useLedges";
import { findDefaultHourIndex, getDefaultWindowIso, getUniqueSortedTimestamps } from "@/lib/time";
import type { LedgeCondition } from "@/lib/types";

const SYDNEY_CENTER: [number, number] = [-33.87, 151.21];
const DEFAULT_ZOOM = 10;

export function MapPage() {
  // Fetch window is computed once per mount, not on every render.
  const { fromIso, toIso } = useMemo(() => getDefaultWindowIso(), []);

  const ledgesQuery = useLedges();
  const conditionsQuery = useConditionsAtRange(fromIso, toIso);
  const conditions = conditionsQuery.data ?? [];

  const hours = useMemo(() => getUniqueSortedTimestamps(conditions), [conditions]);

  // null = "follow the default (current hour)"; a number once the user drags the slider.
  const [manualIndex, setManualIndex] = useState<number | null>(null);
  const hourIndex = manualIndex ?? findDefaultHourIndex(hours);
  const selectedTs: string | undefined = hours[hourIndex];

  const conditionsByLedgeId = useMemo(() => {
    const map = new Map<string, LedgeCondition>();
    if (!selectedTs) return map;
    for (const condition of conditions) {
      if (condition.ts === selectedTs) map.set(condition.ledgeId, condition);
    }
    return map;
  }, [conditions, selectedTs]);

  const isLoading = ledgesQuery.isLoading || conditionsQuery.isLoading;
  const isError = ledgesQuery.isError || conditionsQuery.isError;

  return (
    <div className="flex h-full flex-col">
      <DisclaimerBanner />

      <div className="flex flex-1 flex-col gap-3 overflow-hidden p-3 md:flex-row">
        <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-lg border border-slate-200">
          {isError && (
            <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/85 p-4 text-center text-sm text-red-700">
              Couldn&rsquo;t load ledge data. The API may not be live yet.
            </div>
          )}
          <MapContainer center={SYDNEY_CENTER} zoom={DEFAULT_ZOOM} className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {ledgesQuery.data && (
              <>
                <PressureGlow ledges={ledgesQuery.data} conditionsByLedgeId={conditionsByLedgeId} />
                <LedgeMarkers ledges={ledgesQuery.data} conditionsByLedgeId={conditionsByLedgeId} />
              </>
            )}
          </MapContainer>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] p-3">
            <div className="pointer-events-auto mx-auto max-w-md">
              <HourSlider hours={hours} index={hourIndex} onChange={setManualIndex} />
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 md:w-80 md:shrink-0">
          <HeatmapLegend />
          {isLoading && <p className="text-sm text-slate-500">Loading conditions…</p>}
          {!isLoading && !isError && hours.length === 0 && (
            <p className="text-sm text-slate-500">No conditions in range yet — check back soon.</p>
          )}
        </div>
      </div>

      <AttributionFooter />
    </div>
  );
}
