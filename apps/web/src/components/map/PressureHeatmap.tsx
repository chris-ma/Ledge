import "leaflet.heat";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { pressureToHeatColor } from "@/lib/colorScale";
import type { Ledge, LedgeCondition } from "@/lib/types";

const PANE_NAME = "pressureHeat";
// Below Leaflet's overlayPane (400, where LedgeMarkers's CircleMarkers
// live) so the clickable ledge dot + danger ring always stay visible on
// top of the heat zones, never covered by them.
const PANE_Z_INDEX = "350";

// Real-world zone size: a ~5km solid core fading out to roughly 10km total
// influence, per spec. leaflet.heat's radius/blur are fixed SCREEN pixels,
// not meters, so a single fixed value would only be "5-10km" at one zoom
// level — these get converted to pixels per the current zoom (see
// metersPerPixel) and recalculated on every zoom change instead.
const HEAT_RADIUS_METERS = 5000;
const HEAT_BLUR_METERS = 5000;
// Representative latitude for the meters/pixel conversion (Web Mercator's
// scale factor varies with latitude) — the seeded ledges span a narrow
// enough band (~-33.6 to -34.1) that one reference value stays accurate.
const REFERENCE_LAT = -33.87;

// Deliberately high floor opacity so low-pressure zones still read as a
// visible (if cool-blue) presence rather than fading to near-invisible.
const HEAT_MIN_OPACITY = 0.45;

const HEAT_GRADIENT: Record<number, string> = {
  0: pressureToHeatColor(0),
  0.33: pressureToHeatColor(33),
  0.66: pressureToHeatColor(66),
  1: pressureToHeatColor(100),
};

/** Web Mercator ground resolution at a given zoom/latitude (Leaflet's default CRS). */
function metersPerPixel(zoom: number, latDeg: number): number {
  return (156543.03392 * Math.cos((latDeg * Math.PI) / 180)) / 2 ** zoom;
}

function heatRadiusForZoom(zoom: number): { radius: number; blur: number } {
  const mpp = metersPerPixel(zoom, REFERENCE_LAT);
  return { radius: HEAT_RADIUS_METERS / mpp, blur: HEAT_BLUR_METERS / mpp };
}

function buildHeatPoints(
  ledges: Ledge[],
  conditionsByLedgeId: Map<string, LedgeCondition>,
): Array<[number, number, number]> {
  const points: Array<[number, number, number]> = [];

  for (const ledge of ledges) {
    const pressure = conditionsByLedgeId.get(ledge.id)?.fishingPressure;
    if (pressure === null || pressure === undefined) continue;
    const intensity = Math.min(1, Math.max(0, pressure / 100));
    // The ledge's own coordinate — the same point its swell/tide data is
    // queried against — rather than synthetic offset samples. At a 5-10km
    // radius, one point per ledge already spans a wide enough area to blend
    // naturally with nearby ledges without needing to fake a coastline shape.
    points.push([ledge.lat, ledge.lon, intensity]);
  }

  return points;
}

interface PressureHeatmapProps {
  ledges: Ledge[];
  /** condition at the currently-selected hour, keyed by ledgeId. */
  conditionsByLedgeId: Map<string, LedgeCondition>;
}

/**
 * A continuous Fishing Pressure heat layer — zones, not point markers,
 * centered on each ledge's real coordinate and sized to a genuine 5-10km
 * real-world radius (recalculated on zoom so it stays accurate at any zoom
 * level), so nearby ledges' zones cover each other and blend into one
 * connected region. Uses leaflet.heat's canvas accumulation for genuine
 * blending — stacked CSS-gradient shapes can't do this, they just layer on
 * top of each other. Ledges with no fishingPressure for the selected hour
 * contribute no points at all, never a fabricated cold zone.
 */
export function PressureHeatmap({ ledges, conditionsByLedgeId }: PressureHeatmapProps) {
  const map = useMap();
  const layerRef = useRef<L.HeatLayer | null>(null);

  useEffect(() => {
    if (!map.getPane(PANE_NAME)) {
      const pane = map.createPane(PANE_NAME);
      pane.style.zIndex = PANE_Z_INDEX;
      pane.style.pointerEvents = "none";
    }

    const points = buildHeatPoints(ledges, conditionsByLedgeId);
    const { radius, blur } = heatRadiusForZoom(map.getZoom());
    const layer = L.heatLayer(points, {
      radius,
      blur,
      minOpacity: HEAT_MIN_OPACITY,
      max: 1,
      gradient: HEAT_GRADIENT,
      pane: PANE_NAME,
    });
    layer.addTo(map);
    layerRef.current = layer;

    const handleZoom = () => {
      const next = heatRadiusForZoom(map.getZoom());
      layer.setOptions(next);
    };
    map.on("zoomend", handleZoom);

    return () => {
      map.off("zoomend", handleZoom);
      layer.remove();
      layerRef.current = null;
    };
  }, [map, ledges, conditionsByLedgeId]);

  return null;
}
