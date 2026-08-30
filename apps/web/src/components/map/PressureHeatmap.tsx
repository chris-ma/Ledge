import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { fishingConditionColor } from "@/lib/colorScale";
import type { Ledge, LedgeCondition } from "@/lib/types";

const PANE_NAME = "pressureHeat";
// Below Leaflet's overlayPane (400, where LedgeMarkers's CircleMarkers
// live) so the clickable tap target always stays reachable on top.
const PANE_Z_INDEX = "350";

// A small, non-blended circle right at each ledge's shoreline coordinate.
// Leaflet's L.circle takes its radius in real metres (unlike a heat layer's
// fixed screen-pixel radius), so this stays a true 5-10m footprint at any
// zoom without conversion math, and — since it's the exact coordinate a
// ledge's swell/tide data is queried against — it never spreads far enough
// to land on anything inland.
const ZONE_RADIUS_M = 7; // mid-point of the requested 5-10m
const ZONE_FILL_OPACITY = 0.6;

interface PressureHeatmapProps {
  ledges: Ledge[];
  /** condition at the currently-selected hour, keyed by ledgeId. */
  conditionsByLedgeId: Map<string, LedgeCondition>;
}

/**
 * One small solid-color circle per ledge, right at its shoreline coordinate,
 * colored by its Fishing Pressure for the selected hour. Deliberately NOT a
 * blended/blurred heat layer — each ledge's circle is independent and
 * opaque, so colors never cross over or blend between nearby ledges. At a
 * 5-10m radius no two seeded ledges sit anywhere near close enough to
 * actually touch; if any future ledge ever does, plain circles resolve the
 * overlap by paint order (later-added draws on top) rather than blending —
 * there's deliberately no per-pixel "nearest ledge wins" computation here,
 * since it can't currently be observed at this scale. Ledges with no
 * fishingPressure for the selected hour get no circle at all, never a
 * fabricated cold one.
 */
export function PressureHeatmap({ ledges, conditionsByLedgeId }: PressureHeatmapProps) {
  const map = useMap();
  const circlesRef = useRef<L.Circle[]>([]);

  useEffect(() => {
    if (!map.getPane(PANE_NAME)) {
      const pane = map.createPane(PANE_NAME);
      pane.style.zIndex = PANE_Z_INDEX;
      pane.style.pointerEvents = "none";
    }

    const circles: L.Circle[] = [];
    for (const ledge of ledges) {
      const pressure = conditionsByLedgeId.get(ledge.id)?.fishingPressure;
      if (pressure === null || pressure === undefined) continue;

      const color = fishingConditionColor(pressure);
      const circle = L.circle([ledge.lat, ledge.lon], {
        radius: ZONE_RADIUS_M,
        pane: PANE_NAME,
        color,
        weight: 0,
        fillColor: color,
        fillOpacity: ZONE_FILL_OPACITY,
      });
      circle.addTo(map);
      circles.push(circle);
    }
    circlesRef.current = circles;

    return () => {
      for (const circle of circles) circle.remove();
      circlesRef.current = [];
    };
  }, [map, ledges, conditionsByLedgeId]);

  return null;
}
