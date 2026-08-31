import { CircleMarker, Tooltip } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import { DangerBadge } from "@/components/shared/DangerBadge";
import { FishingBadge } from "@/components/shared/FishingBadge";
import { distanceKm } from "@/lib/geo";
import type { Ledge, LedgeCondition } from "@/lib/types";

// Below this offset, the weather station point is close enough to the
// ledge's own coordinate that calling it out would just be noise — only
// worth a mention once the tide fetch actually had to fall back offshore
// (see fetchTideWithFallback in server/computeAndUpsert.ts, an ~8km nudge).
const NOTABLE_OFFSET_KM = 1;

function weatherStationOffsetKm(ledge: Ledge): number | null {
  if (ledge.weatherStationLat === null || ledge.weatherStationLon === null) return null;
  return distanceKm(ledge.lat, ledge.lon, ledge.weatherStationLat, ledge.weatherStationLon);
}

interface LedgeMarkersProps {
  ledges: Ledge[];
  /** condition at the currently-selected hour, keyed by ledgeId. */
  conditionsByLedgeId: Map<string, LedgeCondition>;
}

// No visible dot or danger ring — the map's only visible per-ledge read is
// now PressureHeatmap's zones. This stays invisible (0 opacity/fill) purely
// as a tap/hover target so click-through to a ledge's detail page and the
// info tooltip keep working without drawing a "point" on the map.
const HIT_RADIUS = 12;

/** Invisible per-ledge tap targets — click navigates to the ledge detail page, hover shows the info tooltip. */
export function LedgeMarkers({ ledges, conditionsByLedgeId }: LedgeMarkersProps) {
  const navigate = useNavigate();

  return (
    <>
      {ledges.map((ledge) => {
        const condition = conditionsByLedgeId.get(ledge.id);
        const fishingPressure = condition?.fishingPressure ?? null;
        const position: [number, number] = [ledge.lat, ledge.lon];
        const offsetKm = weatherStationOffsetKm(ledge);

        return (
          <CircleMarker
            key={ledge.id}
            center={position}
            radius={HIT_RADIUS}
            opacity={0}
            fillOpacity={0}
            eventHandlers={{
              click: () => navigate(`/ledges/${ledge.id}`),
            }}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              <div className="flex flex-col gap-1 text-xs">
                <div className="font-semibold">{ledge.name}</div>
                <div>{ledge.area}</div>
                <div>
                  Fishing condition: {fishingPressure === null ? "no data" : Math.round(fishingPressure)}
                </div>
                <div className="flex items-center gap-1">
                  <DangerBadge tier={condition?.dangerTier ?? null} />
                  <FishingBadge tier={condition?.fishingTier ?? null} />
                </div>
                {offsetKm !== null && offsetKm >= NOTABLE_OFFSET_KM && (
                  <div>Tide data sourced ~{Math.round(offsetKm)}km offshore</div>
                )}
                {!ledge.heightVerified && <div>Unverified location/height</div>}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}
