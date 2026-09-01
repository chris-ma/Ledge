import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { useMap } from "react-leaflet";
import { pressureToHeatColor } from "@/lib/colorScale";
import { localFishingCondition } from "@/lib/fishingLocal";
import type { CoastlineSegment, Ledge, LedgeCondition } from "@/lib/types";

const PANE_NAME = "pressureHeat";
// Below Leaflet's overlayPane (400, where LedgeMarkers's CircleMarkers
// live) so the clickable tap target always stays reachable on top.
const PANE_Z_INDEX = "350";

/**
 * Glow radius is a generous, roughly screen-constant size — the same choice
 * heatmap.js/leaflet.heat make — rather than shrinking with the real-world
 * spacing between vertices. A radius tied to vertex spacing reads as a
 * precise but thin outline of the coast at any zoom; what actually looks
 * like a heat map is big, soft, overlapping blobs that bloom well past each
 * point, blending into broad hot regions the way the reference does. It
 * still grows a little with zoom so a close-in headland isn't swallowed by
 * one giant blob, but the min/max keep it fat at every zoom level rather
 * than tapering to a thread when the view pulls back to the whole city.
 */
const GLOW_RADIUS_AT_REFERENCE_ZOOM_PX = 34;
const GLOW_RADIUS_REFERENCE_ZOOM = 13;
const GLOW_RADIUS_MIN_PX = 16;
const GLOW_RADIUS_MAX_PX = 60;

function glowRadiusPx(zoom: number): number {
  const scaled = GLOW_RADIUS_AT_REFERENCE_ZOOM_PX * 2 ** (zoom - GLOW_RADIUS_REFERENCE_ZOOM);
  return Math.round(Math.min(GLOW_RADIUS_MAX_PX, Math.max(GLOW_RADIUS_MIN_PX, scaled)));
}
/**
 * Peak alpha at a glow's centre scales with the score itself, not a flat
 * value: a cold, "nothing happening here" reading should all but disappear
 * into the base map, while a genuinely warm spot is the thing that's meant
 * to draw the eye. Both ends stay well under 1 — even the hottest spot
 * stays translucent, so the map is always visible underneath.
 */
const GLOW_ALPHA_MIN = 0.08;
const GLOW_ALPHA_MAX = 0.55;

function glowPeakAlpha(score: number): number {
  const t = Math.min(100, Math.max(0, score)) / 100;
  return GLOW_ALPHA_MIN + (GLOW_ALPHA_MAX - GLOW_ALPHA_MIN) * t;
}
/** Score buckets to pre-render glow sprites for — 5-point steps are finer than the eye reads off a colour ramp. */
const SCORE_BUCKET = 5;
/** Extra viewport margin drawn beyond the visible map, as a fraction of its size, so a pan doesn't expose a bare edge before the redraw. */
const VIEWPORT_PADDING = 0.25;

interface HeatPoint {
  lat: number;
  lon: number;
  score: number;
}

/**
 * A soft radial glow in the given colour, cached per score bucket. Drawing
 * these overlapping along the shore is what makes the overlay read as a heat
 * map: the colour bleeds and blends between neighbouring vertices instead of
 * ending at a hard stroke edge.
 */
function buildGlowSprite(score: number, radius: number): HTMLCanvasElement {
  const size = radius * 2;
  const sprite = document.createElement("canvas");
  sprite.width = size;
  sprite.height = size;

  const ctx = sprite.getContext("2d");
  if (!ctx) return sprite;

  const color = pressureToHeatColor(score);
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);

  const peakAlpha = glowPeakAlpha(score);
  const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
  // Held near full strength through the middle then faded off, so the band
  // has a solid core and a feathered edge rather than looking hollow.
  gradient.addColorStop(0, `rgba(${r},${g},${b},${peakAlpha})`);
  gradient.addColorStop(0.45, `rgba(${r},${g},${b},${peakAlpha * 0.75})`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return sprite;
}

interface PressureHeatmapProps {
  /** Real coastline runs, each carrying its per-vertex seaward bearings. */
  coastline: CoastlineSegment[];
  ledges: Ledge[];
  /** condition at the currently-selected hour, keyed by ledgeId. */
  conditionsByLedgeId: Map<string, LedgeCondition>;
}

/**
 * Paints the real shoreline as a heat map: every coastline vertex is scored
 * against its own local aspect, then drawn as a soft glow in that score's
 * colour. The glows overlap along the shore, so the colour bleeds and blends
 * the way a thermal image does rather than reading as a set of flat coloured
 * strokes.
 *
 * Because each vertex is scored on the direction *it* faces, the shore
 * varies along its own length: on an ebb the west-facing side of a headland
 * runs hot while the east-facing side stays cold, and it inverts on the
 * flood. Swell adds on top of that for the exposed aspects.
 *
 * Drawn onto one canvas rather than as thousands of Leaflet paths — this is
 * several thousand vertices, and it also gives the soft-edged blending that
 * a stroked path can't do.
 */
export function PressureHeatmap({ coastline, ledges, conditionsByLedgeId }: PressureHeatmapProps) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ledgesById = useMemo(() => new Map(ledges.map((l) => [l.id, l])), [ledges]);

  const points = useMemo<HeatPoint[]>(() => {
    const out: HeatPoint[] = [];
    for (const segment of coastline) {
      const condition = conditionsByLedgeId.get(segment.ledgeId);
      const ledge = ledgesById.get(segment.ledgeId);
      if (!condition || !ledge) continue;

      segment.path.forEach(([lat, lon], i) => {
        // Rows built before per-vertex bearings existed fall back to the
        // ledge's own facing bearing — flat across the run, but the right
        // ballpark rather than nothing.
        const score = localFishingCondition(
          condition,
          segment.bearings?.[i] ?? ledge.facingBearing,
          ledge.sheltered,
        );
        // No reading for this hour paints nothing at all, rather than a
        // fabricated cold value.
        if (score !== null) out.push({ lat, lon, score });
      });
    }
    return out;
  }, [coastline, ledgesById, conditionsByLedgeId]);

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

    const sprites = new Map<number, HTMLCanvasElement>();
    let spriteRadius = -1;
    const spriteFor = (score: number, radius: number) => {
      if (radius !== spriteRadius) {
        sprites.clear();
        spriteRadius = radius;
      }
      const bucket = Math.round(score / SCORE_BUCKET) * SCORE_BUCKET;
      let sprite = sprites.get(bucket);
      if (!sprite) {
        sprite = buildGlowSprite(bucket, radius);
        sprites.set(bucket, sprite);
      }
      return sprite;
    };

    const redraw = () => {
      const size = map.getSize();
      const pad = size.multiplyBy(VIEWPORT_PADDING);
      const padded = size.add(pad.multiplyBy(2));
      // Anchored in layer coordinates, so the canvas travels with the map
      // during a pan and only needs redrawing once the gesture settles.
      const origin = map.containerPointToLayerPoint(pad.multiplyBy(-1)).round();
      const dpr = window.devicePixelRatio || 1;
      const radius = glowRadiusPx(map.getZoom());

      canvas.width = padded.x * dpr;
      canvas.height = padded.y * dpr;
      canvas.style.width = `${padded.x}px`;
      canvas.style.height = `${padded.y}px`;
      L.DomUtil.setPosition(canvas, origin);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, padded.x, padded.y);

      for (const point of points) {
        const p = map.latLngToLayerPoint([point.lat, point.lon]).subtract(origin);
        // Cheap cull: anything fully outside the padded canvas can't show.
        if (
          p.x < -radius ||
          p.y < -radius ||
          p.x > padded.x + radius ||
          p.y > padded.y + radius
        ) {
          continue;
        }
        ctx.drawImage(spriteFor(point.score, radius), p.x - radius, p.y - radius);
      }
    };

    redraw();
    map.on("moveend zoomend resize viewreset", redraw);

    return () => {
      map.off("moveend zoomend resize viewreset", redraw);
      canvas.remove();
      canvasRef.current = null;
    };
  }, [map, points]);

  return null;
}
