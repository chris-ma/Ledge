import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { windSpeedColor } from "@/lib/colorScale";
import type { Ledge, LedgeCondition } from "@/lib/types";

const PANE_NAME = "windOverlay";
// Above PressureHeatmap's glow (350), below LedgeMarkers's tap targets (400).
const PANE_Z_INDEX = "355";

const ARROW_SIZE_PX = 22;
/** Flat 10% opacity per arrow — these are discrete, non-overlapping icons (unlike PressureHeatmap's blended glow), so there's no alpha-stacking to guard against here. */
const ARROW_OPACITY = 0.1;

function buildArrowIcon(color: string, windDirDeg: number): L.DivIcon {
  // windDirDeg is the bearing the wind blows FROM (meteorological
  // convention) — rotate the arrow 180deg from that so it points where the
  // wind is actually going, matching how wind arrows read on a weather map.
  const pointingDeg = (windDirDeg + 180) % 360;
  return L.divIcon({
    className: "",
    html: `<svg width="${ARROW_SIZE_PX}" height="${ARROW_SIZE_PX}" viewBox="0 0 24 24" fill="none"
        style="opacity:${ARROW_OPACITY}; transform: rotate(${pointingDeg}deg);">
      <path d="M12 3v17M12 3l-6 6M12 3l6 6" stroke="${color}" stroke-width="3.5"
        stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    iconSize: [ARROW_SIZE_PX, ARROW_SIZE_PX],
    // Anchored at centre — this is a direction indicator, not a pin.
    iconAnchor: [ARROW_SIZE_PX / 2, ARROW_SIZE_PX / 2],
  });
}

interface WindOverlayProps {
  ledges: Ledge[];
  /** condition at the currently-selected hour, keyed by ledgeId. */
  conditionsByLedgeId: Map<string, LedgeCondition>;
}

/**
 * Draws a wind-direction arrow over each ledge's general (landmark)
 * location — deliberately NOT tied to the coastline geometry PressureHeatmap
 * paints along, since wind is a single overland reading rather than
 * something that varies with local shore aspect. Coloured by speed (green
 * under 10kt, yellow 10-15kt, red over 15kt) and rotated to point the
 * direction the wind is blowing toward. A ledge with no wind reading this
 * hour draws nothing.
 */
export function WindOverlay({ ledges, conditionsByLedgeId }: WindOverlayProps) {
  const map = useMap();
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!map.getPane(PANE_NAME)) {
      const pane = map.createPane(PANE_NAME);
      pane.style.zIndex = PANE_Z_INDEX;
      pane.style.pointerEvents = "none";
    }

    const markers: L.Marker[] = [];
    for (const ledge of ledges) {
      const condition = conditionsByLedgeId.get(ledge.id);
      const speed = condition?.windSpeedMs;
      const dir = condition?.windDirDeg;
      if (speed === null || speed === undefined || dir === null || dir === undefined) continue;

      const marker = L.marker([ledge.lat, ledge.lon], {
        icon: buildArrowIcon(windSpeedColor(speed), dir),
        pane: PANE_NAME,
        interactive: false,
        keyboard: false,
      });
      marker.addTo(map);
      markers.push(marker);
    }
    markersRef.current = markers;

    return () => {
      for (const marker of markers) marker.remove();
      markersRef.current = [];
    };
  }, [map, ledges, conditionsByLedgeId]);

  return null;
}
