import L from "leaflet";
import { Marker, Pane } from "react-leaflet";
import { pressureToGlowSize, pressureToHeatColor } from "@/lib/colorScale";
import type { Ledge, LedgeCondition } from "@/lib/types";

const GLOW_PANE_NAME = "pressureGlow";
// Below Leaflet's overlayPane (400, where CircleMarkers live) so the
// clickable ledge dot + danger ring from LedgeMarkers always stay visible
// on top of the glow, not covered by it.
const GLOW_PANE_Z_INDEX = 350;

function buildGlowIcon(pressure: number): L.DivIcon {
  const size = Math.round(pressureToGlowSize(pressure));
  const color = pressureToHeatColor(pressure);
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:radial-gradient(circle, ${color}cc 0%, ${color}66 45%, transparent 72%);filter:blur(4px);"></div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

interface PressureGlowProps {
  ledges: Ledge[];
  /** condition at the currently-selected hour, keyed by ledgeId. */
  conditionsByLedgeId: Map<string, LedgeCondition>;
}

/**
 * A soft blurred glow per ledge, sized and colored by the Fishing Pressure
 * Index — "where's the pressure hottest right now" at a glance (blue/calm
 * through red/hot), echoing a thermal/noise-contour heat map. Ledges with no
 * fishingPressure data for the selected hour render no glow at all, never a
 * fabricated cold one. Purely a rendering layer: it reads the same
 * conditionsByLedgeId the hour slider already drives, so dragging the
 * slider moves/reshapes the glow in place.
 */
export function PressureGlow({ ledges, conditionsByLedgeId }: PressureGlowProps) {
  return (
    <Pane name={GLOW_PANE_NAME} style={{ zIndex: GLOW_PANE_Z_INDEX }}>
      {ledges.map((ledge) => {
        const pressure = conditionsByLedgeId.get(ledge.id)?.fishingPressure;
        if (pressure === null || pressure === undefined) return null;
        return (
          <Marker
            key={ledge.id}
            position={[ledge.lat, ledge.lon]}
            icon={buildGlowIcon(pressure)}
            interactive={false}
            keyboard={false}
          />
        );
      })}
    </Pane>
  );
}
