import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { useMap } from "react-leaflet";
import { fishingConditionColor } from "@/lib/colorScale";
import { localFishingCondition } from "@/lib/fishingLocal";
import type { CoastlineSegment, Ledge, LedgeCondition } from "@/lib/types";

const PANE_NAME = "pressureHeat";
// Below Leaflet's overlayPane (400, where LedgeMarkers's CircleMarkers
// live) so the clickable tap target always stays reachable on top.
const PANE_Z_INDEX = "350";

const LINE_WEIGHT_PX = 6;
const LINE_OPACITY = 0.9;

interface PressureHeatmapProps {
  /** Real coastline runs, each carrying its per-vertex seaward bearings. */
  coastline: CoastlineSegment[];
  ledges: Ledge[];
  /** condition at the currently-selected hour, keyed by ledgeId. */
  conditionsByLedgeId: Map<string, LedgeCondition>;
}

/**
 * Paints the real shoreline as a heat map, scoring every vertex against its
 * own local aspect rather than washing a whole ledge's stretch in one
 * colour. That's what makes it read as a heat map instead of a set of
 * uniform strokes: around a headland the shore turns through the compass, so
 * on an ebb the west-facing side lights up while the east-facing side stays
 * cold, and the pattern inverts on the flood. Swell adds to the exposed
 * aspects on top of that.
 *
 * Drawn one short sub-segment per vertex pair, which is thousands of paths —
 * hence a canvas renderer rather than Leaflet's default SVG, which bogs down
 * well before this count. Shore whose ledge has no reading for the hour is
 * left unpainted rather than coloured a fabricated cold value.
 */
export function PressureHeatmap({ coastline, ledges, conditionsByLedgeId }: PressureHeatmapProps) {
  const map = useMap();
  const layersRef = useRef<L.Polyline[]>([]);

  const ledgesById = useMemo(() => new Map(ledges.map((l) => [l.id, l])), [ledges]);

  useEffect(() => {
    if (!map.getPane(PANE_NAME)) {
      const pane = map.createPane(PANE_NAME);
      pane.style.zIndex = PANE_Z_INDEX;
      pane.style.pointerEvents = "none";
    }

    const renderer = L.canvas({ pane: PANE_NAME, padding: 0.5 });
    const layers: L.Polyline[] = [];

    for (const segment of coastline) {
      const condition = conditionsByLedgeId.get(segment.ledgeId);
      const ledge = ledgesById.get(segment.ledgeId);
      if (!condition || !ledge) continue;

      const { path } = segment;
      // Rows built before per-vertex bearings existed fall back to the
      // ledge's own facing bearing — a flat stretch rather than a gradient,
      // but still the right ballpark colour.
      const scores = path.map((_, i) =>
        localFishingCondition(
          condition,
          segment.bearings?.[i] ?? ledge.facingBearing,
          ledge.sheltered,
        ),
      );

      for (let i = 1; i < path.length; i++) {
        const from = scores[i - 1];
        const to = scores[i];
        if (from === null || to === null) continue;

        const line = L.polyline([path[i - 1], path[i]], {
          renderer,
          color: fishingConditionColor((from + to) / 2),
          weight: LINE_WEIGHT_PX,
          opacity: LINE_OPACITY,
          lineCap: "round",
        });
        line.addTo(map);
        layers.push(line);
      }
    }
    layersRef.current = layers;

    return () => {
      for (const layer of layers) layer.remove();
      layersRef.current = [];
    };
  }, [map, coastline, ledgesById, conditionsByLedgeId]);

  return null;
}
