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
// symmetric blob floating in open water. Kept short — several harbour
// ledges (Blues Point, Kirribilli, Camp Cove, Barrenjoey) sit on narrow
// points of land, and a wide spread here risks wandering past them.
const COAST_SAMPLE_DISTANCES_KM = [0, 0.3, 0.6];
// A single sample pushed out to sea (facing_bearing itself) at reduced
// intensity, so the zone fans outward toward open water a little rather
// than reading as a flat line — kept short for the same reason as above.
const SEAWARD_SAMPLES: ReadonlyArray<{ distanceKm: number; intensityFactor: number }> = [
  { distanceKm: 0.25, intensityFactor: 0.8 },
];

// leaflet.heat's radius/blur are fixed SCREEN pixels, not meters — at the
// map's city-wide default zoom that made the previous 70/45 cover several
// kilometres of real ground per point, easily spilling over narrow points
// of land onto the suburbs behind them. Tightened so the visible glow stays
// close to each ledge's actual coastline; ledges a few hundred metres to
// ~1km apart (the harbour cluster especially) can still blend together.
const HEAT_RADIUS = 24;
const HEAT_BLUR = 16;
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
