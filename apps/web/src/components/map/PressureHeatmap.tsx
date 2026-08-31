import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import { fishingConditionColor } from "@/lib/colorScale";
import { destinationPoint } from "@/lib/geo";
import type { Ledge, LedgeCondition } from "@/lib/types";

const PANE_NAME = "pressureHeat";
// Below Leaflet's overlayPane (400, where LedgeMarkers's CircleMarkers
// live) so the clickable tap target always stays reachable on top.
const PANE_Z_INDEX = "350";

// Real coastline geometry isn't available in this build (see PR history) —
// each ledge's mark is a short line synthesized from its own coordinate and
// facing_bearing, running "along the coast" (perpendicular to the bearing
// that points out to sea) rather than a point. It's drawn at a genuine
// real-world length (not a fixed screen-pixel size), which means it's only
// a couple of screen pixels — effectively invisible — at the map's default
// city-wide zoom. Rather than fake the length to force default-zoom
// visibility (which would make it span well past any one ledge's actual
// platform and blend into its neighbours), it's simply not drawn until
// zoomed in close enough to see a realistic-length line for what it is —
// same as any small real-world feature on any map.
const MIN_VISIBLE_ZOOM = 14;
const SEGMENT_HALF_LENGTH_KM = 0.1; // 100m each side, 200m total
const LINE_WEIGHT_PX = 8;
const LINE_OPACITY = 0.8;

interface LatLon {
  lat: number;
  lon: number;
}

/** Two endpoints of a short line through the ledge's point, parallel to the coast at that spot. */
function shorelineEndpoints(ledge: Ledge): [LatLon, LatLon] {
  const alongCoast = (ledge.facingBearing + 90) % 360;
  return [
    destinationPoint(ledge.lat, ledge.lon, alongCoast, SEGMENT_HALF_LENGTH_KM),
    destinationPoint(ledge.lat, ledge.lon, (alongCoast + 180) % 360, SEGMENT_HALF_LENGTH_KM),
  ];
}

interface PressureHeatmapProps {
  ledges: Ledge[];
  /** condition at the currently-selected hour, keyed by ledgeId. */
  conditionsByLedgeId: Map<string, LedgeCondition>;
}

/**
 * One short line per ledge, tracing the shoreline at that point (rather than
 * a dot at its coordinate), colored by its Fishing Pressure for the selected
 * hour. Only rendered once the map is zoomed past MIN_VISIBLE_ZOOM — see the
 * comment above for why a real-world-length line can't also be visible at
 * the default zoom. Deliberately NOT a blended/blurred heat layer — each
 * ledge's line is independent and opaque, so colors never cross over or
 * blend between nearby ledges. Ledges with no fishingPressure for the
 * selected hour get no line at all, never a fabricated cold one.
 */
export function PressureHeatmap({ ledges, conditionsByLedgeId }: PressureHeatmapProps) {
  const map = useMap();
  const linesRef = useRef<L.Polyline[]>([]);
  const [zoom, setZoom] = useState(() => map.getZoom());

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on("zoomend", onZoom);
    return () => {
      map.off("zoomend", onZoom);
    };
  }, [map]);

  useEffect(() => {
    if (!map.getPane(PANE_NAME)) {
      const pane = map.createPane(PANE_NAME);
      pane.style.zIndex = PANE_Z_INDEX;
      pane.style.pointerEvents = "none";
    }

    const lines: L.Polyline[] = [];
    if (zoom >= MIN_VISIBLE_ZOOM) {
      for (const ledge of ledges) {
        const pressure = conditionsByLedgeId.get(ledge.id)?.fishingPressure;
        if (pressure === null || pressure === undefined) continue;

        const color = fishingConditionColor(pressure);
        const [a, b] = shorelineEndpoints(ledge);
        const line = L.polyline(
          [
            [a.lat, a.lon],
            [b.lat, b.lon],
          ],
          {
            pane: PANE_NAME,
            color,
            weight: LINE_WEIGHT_PX,
            opacity: LINE_OPACITY,
            lineCap: "round",
          },
        );
        line.addTo(map);
        lines.push(line);
      }
    }
    linesRef.current = lines;

    return () => {
      for (const line of lines) line.remove();
      linesRef.current = [];
    };
  }, [map, ledges, conditionsByLedgeId, zoom]);

  return null;
}
