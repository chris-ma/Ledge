import type { ReactElement } from "react";
import { CircleMarker, Tooltip } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import { DangerBadge } from "@/components/shared/DangerBadge";
import type { Ledge, LedgeCondition } from "@/lib/types";
import { lliToColor } from "@/lib/colorScale";

interface LedgeMarkersProps {
  ledges: Ledge[];
  /** condition at the currently-selected hour, keyed by ledgeId. */
  conditionsByLedgeId: Map<string, LedgeCondition>;
}

const FILL_RADIUS = 9;
const DANGER_RING_RADIUS = 15;

/**
 * One CircleMarker per ledge, colored by LLI. Ledges whose condition at the
 * selected hour has a non-normal dangerTier get a second, larger,
 * stroke-only red CircleMarker layered underneath as a ring — react-leaflet
 * has no native marker glow, so a second marker is the pragmatic way to draw
 * a ring independent of the fill color.
 */
export function LedgeMarkers({ ledges, conditionsByLedgeId }: LedgeMarkersProps) {
  const navigate = useNavigate();
  const markers: ReactElement[] = [];

  for (const ledge of ledges) {
    const condition = conditionsByLedgeId.get(ledge.id);
    const lli = condition?.lli ?? null;
    const position: [number, number] = [ledge.lat, ledge.lon];
    const isDangerLike = condition?.dangerTier != null && condition.dangerTier !== "normal";

    if (isDangerLike) {
      markers.push(
        <CircleMarker
          key={`${ledge.id}-ring`}
          center={position}
          radius={DANGER_RING_RADIUS}
          color="#dc2626"
          weight={3}
          fill={false}
          interactive={false}
        />,
      );
    }

    markers.push(
      <CircleMarker
        key={ledge.id}
        center={position}
        radius={FILL_RADIUS}
        color="#1e293b"
        weight={1}
        fillColor={lliToColor(lli)}
        fillOpacity={0.9}
        eventHandlers={{
          click: () => navigate(`/ledges/${ledge.id}`),
        }}
      >
        <Tooltip direction="top" offset={[0, -10]}>
          <div className="flex flex-col gap-1 text-xs">
            <div className="font-semibold">{ledge.name}</div>
            <div>{ledge.area}</div>
            <div>LLI: {lli === null ? "no data" : Math.round(lli)}</div>
            <DangerBadge tier={condition?.dangerTier ?? null} />
            {!ledge.heightVerified && <div>Unverified location/height</div>}
          </div>
        </Tooltip>
      </CircleMarker>,
    );
  }

  return <>{markers}</>;
}
