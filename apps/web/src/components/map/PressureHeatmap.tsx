import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { fishingConditionColor } from "@/lib/colorScale";
import type { CoastlineSegment, LedgeCondition } from "@/lib/types";

const PANE_NAME = "pressureHeat";
// Below Leaflet's overlayPane (400, where LedgeMarkers's CircleMarkers
// live) so the clickable tap target always stays reachable on top.
const PANE_Z_INDEX = "350";

// These runs are real OSM coastline (see server/coastline.ts), so they're
// already the right shape and the right length — a stretch of actual
// shoreline, kilometres of it per ledge. Nothing here is synthesized from a
// point, which is what every earlier version of this overlay got wrong, and
// there's no zoom gate: a real coastline run is plainly visible zoomed all
// the way out.
const LINE_WEIGHT_PX = 6;
const LINE_OPACITY = 0.9;

interface PressureHeatmapProps {
  /** Real coastline runs, each tagged with the ledge whose conditions colour it. */
  coastline: CoastlineSegment[];
  /** condition at the currently-selected hour, keyed by ledgeId. */
  conditionsByLedgeId: Map<string, LedgeCondition>;
}

/**
 * Paints each run of real shoreline in its ledge's Fishing Condition colour
 * for the selected hour. Runs whose ledge has no reading for that hour are
 * left undrawn rather than painted a fabricated cold colour — the coastline
 * simply isn't coloured where there's nothing to say about it.
 */
export function PressureHeatmap({ coastline, conditionsByLedgeId }: PressureHeatmapProps) {
  const map = useMap();
  const linesRef = useRef<L.Polyline[]>([]);

  useEffect(() => {
    if (!map.getPane(PANE_NAME)) {
      const pane = map.createPane(PANE_NAME);
      pane.style.zIndex = PANE_Z_INDEX;
      pane.style.pointerEvents = "none";
    }

    const lines: L.Polyline[] = [];
    for (const segment of coastline) {
      const pressure = conditionsByLedgeId.get(segment.ledgeId)?.fishingPressure;
      if (pressure === null || pressure === undefined) continue;

      const line = L.polyline(segment.path, {
        pane: PANE_NAME,
        color: fishingConditionColor(pressure),
        weight: LINE_WEIGHT_PX,
        opacity: LINE_OPACITY,
        lineCap: "round",
        lineJoin: "round",
      });
      line.addTo(map);
      lines.push(line);
    }
    linesRef.current = lines;

    return () => {
      for (const line of lines) line.remove();
      linesRef.current = [];
    };
  }, [map, coastline, conditionsByLedgeId]);

  return null;
}
