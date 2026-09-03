import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { useMap } from "react-leaflet";
import { windSpeedColor } from "@/lib/colorScale";
import { interpolateWindField, windToComponents, type WindSample } from "@/lib/windField";
import type { Ledge, LedgeCondition } from "@/lib/types";

const PANE_NAME = "windOverlay";
// Below PressureHeatmap's coastline glow (350): wind is an ambient
// background texture across the whole map, and the Fishing Condition
// colour along the shore should stay the clear foreground signal on top
// of it, not get washed out by it.
const PANE_Z_INDEX = "340";

/** Low-res raster cell size (CSS px) before the smoothed upscale — this is what gives the soft, continuous field look rather than a blocky grid. */
const FIELD_CELL_PX = 26;
const FIELD_OPACITY = 0.45;

/** Screen-space spacing between direction-streak marks drawn over the field. */
const STREAK_SPACING_PX = 46;
const STREAK_LENGTH_PX = 13;
const STREAK_HEAD_PX = 3.5;
const STREAK_COLOR = "rgba(255,255,255,0.6)";

/** Extra viewport margin drawn beyond the visible map, as a fraction of its size, so a pan doesn't expose a bare edge before the redraw. */
const VIEWPORT_PADDING = 0.25;

interface WindOverlayProps {
  ledges: Ledge[];
  /** condition at the currently-selected hour, keyed by ledgeId. */
  conditionsByLedgeId: Map<string, LedgeCondition>;
}

/**
 * Renders wind as a continuous colour field with direction-streak texture —
 * the Windy.com-style look — rather than per-ledge marks. The 25 ledges'
 * own wind readings are the only real data available (no dense grid), so
 * every other point on screen is an inverse-distance-weighted blend of
 * those readings (see lib/windField.ts): smooth and gap-free everywhere,
 * exact right at a ledge's own coordinate. Deliberately not animated —
 * a real particle-flow simulation is a much bigger step; this gets the
 * visual language (field + direction texture) without it.
 */
export function WindOverlay({ ledges, conditionsByLedgeId }: WindOverlayProps) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const samples = useMemo<WindSample[]>(() => {
    const out: WindSample[] = [];
    for (const ledge of ledges) {
      const condition = conditionsByLedgeId.get(ledge.id);
      if (condition?.windSpeedMs == null || condition?.windDirDeg == null) continue;
      const { u, v } = windToComponents(condition.windSpeedMs, condition.windDirDeg);
      out.push({ lat: ledge.lat, lon: ledge.lon, u, v });
    }
    return out;
  }, [ledges, conditionsByLedgeId]);

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
    // The colour field is rendered at low resolution first, then scaled up
    // with image smoothing — the same trick a real wind-map renderer uses
    // to turn a coarse grid into a soft, continuous-looking blend.
    const fieldRaster = document.createElement("canvas");

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

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, padded.x, padded.y);

      if (samples.length === 0) return;

      const cols = Math.max(1, Math.ceil(padded.x / FIELD_CELL_PX) + 1);
      const rows = Math.max(1, Math.ceil(padded.y / FIELD_CELL_PX) + 1);
      fieldRaster.width = cols;
      fieldRaster.height = rows;
      const rasterCtx = fieldRaster.getContext("2d");
      if (!rasterCtx) return;

      const image = rasterCtx.createImageData(cols, rows);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const layerPoint = origin.add([col * FIELD_CELL_PX, row * FIELD_CELL_PX]);
          const latlng = map.layerPointToLatLng(layerPoint);
          const field = interpolateWindField(samples, latlng.lat, latlng.lng)!;
          const hex = windSpeedColor(field.speed);
          const idx = (row * cols + col) * 4;
          image.data[idx] = parseInt(hex.slice(1, 3), 16);
          image.data[idx + 1] = parseInt(hex.slice(3, 5), 16);
          image.data[idx + 2] = parseInt(hex.slice(5, 7), 16);
          image.data[idx + 3] = 255;
        }
      }
      rasterCtx.putImageData(image, 0, 0);

      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = FIELD_OPACITY;
      ctx.drawImage(fieldRaster, 0, 0, cols, rows, 0, 0, cols * FIELD_CELL_PX, rows * FIELD_CELL_PX);
      ctx.globalAlpha = 1;

      // Direction streaks on top of the field, each a short dash with a
      // small arrowhead — a static render has no motion to show flow, so
      // the arrowhead carries the direction cue an animated version would
      // otherwise get for free.
      ctx.strokeStyle = STREAK_COLOR;
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      for (let py = STREAK_SPACING_PX / 2; py < padded.y; py += STREAK_SPACING_PX) {
        for (let px = STREAK_SPACING_PX / 2; px < padded.x; px += STREAK_SPACING_PX) {
          const latlng = map.layerPointToLatLng(origin.add([px, py]));
          const field = interpolateWindField(samples, latlng.lat, latlng.lng)!;
          const bearing = Math.atan2(field.u, field.v);
          const dx = Math.sin(bearing) * (STREAK_LENGTH_PX / 2);
          const dy = -Math.cos(bearing) * (STREAK_LENGTH_PX / 2);
          const headX = px + dx;
          const headY = py + dy;

          ctx.beginPath();
          ctx.moveTo(px - dx, py - dy);
          ctx.lineTo(headX, headY);
          ctx.moveTo(headX, headY);
          ctx.lineTo(
            headX + Math.sin(bearing + Math.PI - 0.5) * STREAK_HEAD_PX,
            headY - Math.cos(bearing + Math.PI - 0.5) * STREAK_HEAD_PX,
          );
          ctx.moveTo(headX, headY);
          ctx.lineTo(
            headX + Math.sin(bearing + Math.PI + 0.5) * STREAK_HEAD_PX,
            headY - Math.cos(bearing + Math.PI + 0.5) * STREAK_HEAD_PX,
          );
          ctx.stroke();
        }
      }
    };

    redraw();
    map.on("moveend zoomend resize viewreset", redraw);

    return () => {
      map.off("moveend zoomend resize viewreset", redraw);
      canvas.remove();
      canvasRef.current = null;
    };
  }, [map, samples]);

  return null;
}
