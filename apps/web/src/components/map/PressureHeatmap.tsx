import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { fishingConditionColor } from "@/lib/colorScale";
import type { Ledge, LedgeCondition } from "@/lib/types";

const PANE_NAME = "pressureHeat";
// Below Leaflet's overlayPane (400, where LedgeMarkers's CircleMarkers
// live) so the clickable tap target always stays reachable on top.
const PANE_Z_INDEX = "350";

// Each ledge's mark is a short bar centered on its own coordinate, rotated
// to run "along the coast" (perpendicular to facing_bearing, which points
// out to sea) — a stand-in for tracing the real shoreline, which isn't
// available in this build. It's a fixed-PIXEL-size marker (like
// LedgeMarkers's CircleMarker), not a geographic line: an early version drew
// a real-world-length L.polyline instead, which was only a couple of screen
// pixels long at the map's default city-wide zoom and effectively invisible
// — confirmed by rendering it headlessly with real data before switching to
// this approach. A fixed pixel size stays visibly readable at any zoom.
const BAR_LENGTH_PX = 46;
const BAR_THICKNESS_PX = 8;
const ICON_BOX_PX = 64; // must comfortably contain the bar at any rotation
const BAR_OPACITY = 0.85;

interface PressureHeatmapProps {
  ledges: Ledge[];
  /** condition at the currently-selected hour, keyed by ledgeId. */
  conditionsByLedgeId: Map<string, LedgeCondition>;
}

/** Compass bearing (0=N, clockwise) -> CSS rotate() degrees for a bar that's horizontal at 0deg. */
function bearingToCssRotationDeg(bearingDeg: number): number {
  return bearingDeg - 90;
}

/** A short colored bar div-icon, centered in its box and rotated to `alongCoastBearingDeg`. */
function buildBarIcon(color: string, alongCoastBearingDeg: number): L.DivIcon {
  const rotationDeg = bearingToCssRotationDeg(alongCoastBearingDeg);
  return L.divIcon({
    className: "",
    html: `<div style="width:${ICON_BOX_PX}px;height:${ICON_BOX_PX}px;display:flex;align-items:center;justify-content:center;">
      <div style="width:${BAR_LENGTH_PX}px;height:${BAR_THICKNESS_PX}px;background:${color};opacity:${BAR_OPACITY};border-radius:${BAR_THICKNESS_PX / 2}px;transform:rotate(${rotationDeg}deg);"></div>
    </div>`,
    iconSize: [ICON_BOX_PX, ICON_BOX_PX],
    iconAnchor: [ICON_BOX_PX / 2, ICON_BOX_PX / 2],
  });
}

/**
 * One short colored bar per ledge, centered on its coordinate and rotated to
 * run along the coast at that spot, colored by its Fishing Pressure for the
 * selected hour. Deliberately NOT a blended/blurred heat layer — each
 * ledge's bar is independent and opaque, so colors never cross over or
 * blend between nearby ledges. Ledges with no fishingPressure for the
 * selected hour get no bar at all, never a fabricated cold one.
 */
export function PressureHeatmap({ ledges, conditionsByLedgeId }: PressureHeatmapProps) {
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
      const pressure = conditionsByLedgeId.get(ledge.id)?.fishingPressure;
      if (pressure === null || pressure === undefined) continue;

      const color = fishingConditionColor(pressure);
      const alongCoast = (ledge.facingBearing + 90) % 360;
      const icon = buildBarIcon(color, alongCoast);

      const marker = L.marker([ledge.lat, ledge.lon], {
        icon,
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
