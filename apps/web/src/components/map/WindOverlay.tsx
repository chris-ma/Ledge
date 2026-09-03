import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { useMap } from "react-leaflet";
import { windSpeedColor } from "@/lib/colorScale";
import type { CoastlineSegment, LedgeCondition } from "@/lib/types";

const PANE_NAME = "windOverlay";
// Just above PressureHeatmap's glow (350) so the wind lines stay visible
// over it, still below LedgeMarkers's tap targets (400) and DangerFlags (620).
const PANE_Z_INDEX = "355";

const LINE_WIDTH_PX = 3;

/**
 * Flat opacity applied once to the whole rendered layer via the same
 * offscreen-buffer compositing PressureHeatmap uses, not per-stroke — a
 * per-segment globalAlpha would compound wherever two segments' strokes
 * touch (shared endpoints between adjacent ledges' runs), same bug already
 * root-caused there. 10% requested directly, no prior tuning needed since
 * this reuses that fix from the start.
 */
const OVERALL_OPACITY = 0.1;

/** Extra viewport margin drawn beyond the visible map, as a fraction of its size, so a pan doesn't expose a bare edge before the redraw. */
const VIEWPORT_PADDING = 0.25;

interface WindLine {
  path: [number, number][];
  color: string;
}

interface WindOverlayProps {
  /** Real coastline runs to draw the wind reading along. */
  coastline: CoastlineSegment[];
  /** condition at the currently-selected hour, keyed by ledgeId. */
  conditionsByLedgeId: Map<string, LedgeCondition>;
}

/**
 * Draws each ledge's coastline run as a solid line coloured by its current
 * 10m wind speed — green under 10kt, yellow 10-15kt, red over 15kt. Unlike
 * PressureHeatmap, wind isn't scored per-vertex by local aspect: it's one
 * reading per ledge, so the whole run is a single flat colour rather than a
 * blended glow. A ledge with no wind reading this hour draws nothing.
 */
export function WindOverlay({ coastline, conditionsByLedgeId }: WindOverlayProps) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const lines = useMemo<WindLine[]>(() => {
    const out: WindLine[] = [];
    for (const segment of coastline) {
      const windSpeedMs = conditionsByLedgeId.get(segment.ledgeId)?.windSpeedMs;
      if (windSpeedMs === null || windSpeedMs === undefined) continue;
      out.push({ path: segment.path, color: windSpeedColor(windSpeedMs) });
    }
    return out;
  }, [coastline, conditionsByLedgeId]);

  useEffect(() => {
    if (!map.getPane(PANE_NAME)) {
      const pane = map.createPane(PANE_NAME);
      pane.style.zIndex = PANE_Z_INDEX;
      pane.style.pointerEvents = "none";
    }
    const pane = map.getPane(PANE_NAME)!;

    const canvas = L.DomUtil.create("canvas", "leaflet-layer leaflet-zoom-hide") as HTMLCanvasElement;
    pane.appendChild(canvas);
    canvasRef.current = canvas;
    const buffer = document.createElement("canvas");

    const redraw = () => {
      const size = map.getSize();
      const pad = size.multiplyBy(VIEWPORT_PADDING);
      const padded = size.add(pad.multiplyBy(2));
      const origin = map.containerPointToLayerPoint(pad.multiplyBy(-1)).round();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = padded.x * dpr;
      canvas.height = padded.y * dpr;
      canvas.style.width = `${padded.x}px`;
      canvas.style.height = `${padded.y}px`;
      L.DomUtil.setPosition(canvas, origin);
      buffer.width = canvas.width;
      buffer.height = canvas.height;

      const bufCtx = buffer.getContext("2d");
      const ctx = canvas.getContext("2d");
      if (!bufCtx || !ctx) return;
      bufCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bufCtx.clearRect(0, 0, padded.x, padded.y);
      bufCtx.lineWidth = LINE_WIDTH_PX;
      bufCtx.lineCap = "round";
      bufCtx.lineJoin = "round";

      for (const line of lines) {
        if (line.path.length < 2) continue;
        bufCtx.strokeStyle = line.color;
        bufCtx.beginPath();
        line.path.forEach(([lat, lon], i) => {
          const p = map.latLngToLayerPoint([lat, lon]).subtract(origin);
          if (i === 0) bufCtx.moveTo(p.x, p.y);
          else bufCtx.lineTo(p.x, p.y);
        });
        bufCtx.stroke();
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = OVERALL_OPACITY;
      ctx.drawImage(buffer, 0, 0);
      ctx.globalAlpha = 1;
    };

    redraw();
    map.on("moveend zoomend resize viewreset", redraw);

    return () => {
      map.off("moveend zoomend resize viewreset", redraw);
      canvas.remove();
      canvasRef.current = null;
    };
  }, [map, lines]);

  return null;
}
