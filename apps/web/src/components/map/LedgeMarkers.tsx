import { CircleMarker, Tooltip } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import { DangerBadge } from "@/components/shared/DangerBadge";
import { FishingBadge } from "@/components/shared/FishingBadge";
import type { Ledge, LedgeCondition } from "@/lib/types";

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
                {!ledge.heightVerified && <div>Unverified location/height</div>}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}
