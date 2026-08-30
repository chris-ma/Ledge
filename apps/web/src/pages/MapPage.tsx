import { useMemo, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import { HourSlider } from "@/components/map/HourSlider";
import { LedgeMarkers } from "@/components/map/LedgeMarkers";
import { MapLegend } from "@/components/map/MapLegend";
import { PressureHeatmap } from "@/components/map/PressureHeatmap";
import { useConditionsAtRange } from "@/hooks/useConditionsAtRange";
import { useLedges } from "@/hooks/useLedges";
import { computeRegionalTideSeries } from "@/lib/tide";
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
  const tideSeries = useMemo(() => computeRegionalTideSeries(conditions, hours), [conditions, hours]);

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
      <div className="flex flex-1 flex-col gap-3 overflow-hidden p-3 md:flex-row">
        <div className="flex min-h-[70svh] flex-1 flex-col gap-3 overflow-hidden md:min-h-[420px]">
          <div className="relative flex-1 overflow-hidden rounded-lg border border-slate-200">
            {isError && (
              <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/85 p-4 text-center text-sm text-red-700">
                Couldn&rsquo;t load ledge data. The API may not be live yet.
              </div>
            )}
            <MapContainer center={SYDNEY_CENTER} zoom={DEFAULT_ZOOM} className="h-full w-full">
              {/* Esri's ArcGIS Online "Light Gray Canvas" basemap — genuinely free,
                  no API key required (unlike CARTO's basemaps, which now gate
                  their CDN behind an account). Two layers: a muted base plus a
                  reference layer for labels/boundaries on top of it. */}
              <TileLayer
                attribution="Tiles &copy; Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
                maxNativeZoom={16}
              />
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
                maxNativeZoom={16}
              />
              {ledgesQuery.data && (
                <>
                  <PressureHeatmap ledges={ledgesQuery.data} conditionsByLedgeId={conditionsByLedgeId} />
                  <LedgeMarkers ledges={ledgesQuery.data} conditionsByLedgeId={conditionsByLedgeId} />
                </>
              )}
            </MapContainer>

            <MapLegend />
          </div>

          <HourSlider
            hours={hours}
            index={hourIndex}
            onChange={setManualIndex}
            isLive={manualIndex === null}
            tideSeries={tideSeries}
          />
        </div>

        {(isLoading || (!isError && hours.length === 0)) && (
          <div className="flex w-full flex-col gap-3 md:w-80 md:shrink-0">
            {isLoading && <p className="text-sm text-slate-500">Loading conditions…</p>}
            {!isLoading && !isError && hours.length === 0 && (
              <p className="text-sm text-slate-500">No conditions in range yet — check back soon.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
