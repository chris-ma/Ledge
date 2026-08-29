import "leaflet.heat";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { pressureToHeatColor } from "@/lib/colorScale";
import { destinationPoint } from "@/lib/geo";
import type { Ledge, LedgeCondition } from "@/lib/types";

const PANE_NAME = "pressureHeat";
// Below Leaflet's overlayPane (400, where LedgeMarkers's CircleMarkers
// live) so the clickable ledge dot + danger ring always stay visible on
// top of the heat zones, never covered by them.
const PANE_Z_INDEX = "350";

// Samples spread perpendicular to facing_bearing (i.e. along the coast,
// since we have no real coastline geometry to trace against) so each
// ledge's zone reads as hugging the shore through that point, not a
// symmetric blob floating in open water.
const COAST_SAMPLE_DISTANCES_KM = [0, 0.4, 0.8, 1.2];
// A couple of samples pushed out to sea (facing_bearing itself) at reduced
// intensity, so the zone also fans outward a little rather than reading as
// a flat line.
const SEAWARD_SAMPLES: ReadonlyArray<{ distanceKm: number; intensityFactor: number }> = [
  { distanceKm: 0.3, intensityFactor: 0.9 },
  { distanceKm: 0.6, intensityFactor: 0.75 },
];

const HEAT_RADIUS = 70;
const HEAT_BLUR = 45;
// Deliberately high floor opacity so low-pressure zones still read as a
// visible (if cool-blue) presence rather than fading to near-invisible.
const HEAT_MIN_OPACITY = 0.45;

const HEAT_GRADIENT: Record<number, string> = {
  0: pressureToHeatColor(0),
  0.33: pressureToHeatColor(33),
  0.66: pressureToHeatColor(66),
  1: pressureToHeatColor(100),
};

function buildHeatPoints(
  ledges: Ledge[],
  conditionsByLedgeId: Map<string, LedgeCondition>,
): Array<[number, number, number]> {
  const points: Array<[number, number, number]> = [];

  for (const ledge of ledges) {
    const pressure = conditionsByLedgeId.get(ledge.id)?.fishingPressure;
    if (pressure === null || pressure === undefined) continue;
    const intensity = Math.min(1, Math.max(0, pressure / 100));

    const coastBearings = [(ledge.facingBearing + 90) % 360, (ledge.facingBearing + 270) % 360];
    for (const bearing of coastBearings) {
      for (const distanceKm of COAST_SAMPLE_DISTANCES_KM) {
        const point =
          distanceKm === 0
            ? { lat: ledge.lat, lon: ledge.lon }
            : destinationPoint(ledge.lat, ledge.lon, bearing, distanceKm);
        points.push([point.lat, point.lon, intensity]);
      }
    }

    for (const { distanceKm, intensityFactor } of SEAWARD_SAMPLES) {
      const point = destinationPoint(ledge.lat, ledge.lon, ledge.facingBearing, distanceKm);
      points.push([point.lat, point.lon, intensity * intensityFactor]);
    }
  }

  return points;
}

interface PressureHeatmapProps {
  ledges: Ledge[];
  /** condition at the currently-selected hour, keyed by ledgeId. */
  conditionsByLedgeId: Map<string, LedgeCondition>;
}

/**
 * A continuous Fishing Pressure heat layer — zones, not point markers, that
 * trace along each ledge's coastline (approximated via facing_bearing,
 * since real coastline geometry isn't available) and blend into one
 * connected region wherever nearby ledges' zones overlap. Uses leaflet.heat's
 * canvas accumulation for genuine blending — stacked CSS-gradient shapes
 * can't do this, they just layer on top of each other. Ledges with no
 * fishingPressure for the selected hour contribute no points at all, never
 * a fabricated cold zone.
 */
export function PressureHeatmap({ ledges, conditionsByLedgeId }: PressureHeatmapProps) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (!map.getPane(PANE_NAME)) {
      const pane = map.createPane(PANE_NAME);
      pane.style.zIndex = PANE_Z_INDEX;
      pane.style.pointerEvents = "none";
    }

    const points = buildHeatPoints(ledges, conditionsByLedgeId);
    const layer = L.heatLayer(points, {
      radius: HEAT_RADIUS,
      blur: HEAT_BLUR,
      minOpacity: HEAT_MIN_OPACITY,
      max: 1,
      gradient: HEAT_GRADIENT,
      pane: PANE_NAME,
    });
    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      layer.remove();
      layerRef.current = null;
    };
  }, [map, ledges, conditionsByLedgeId]);

  return null;
}
