import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type { Ledge, LedgeCondition } from "@/lib/types";

// Above the marker pane (600) so a flag is never buried under the shoreline
// paint or a tap target — a hazard warning has to be the thing you see.
const PANE_NAME = "dangerFlags";
const PANE_Z_INDEX = "620";

const FLAG_SIZE_PX = 26;

/**
 * Colours by severity rather than flying one flag for both: "caution" and
 * "dangerous" are separate tiers in the model (see server/model/danger.ts)
 * and flattening them would overstate the first or understate the second.
 */
const TIER_STYLE: Record<string, { fill: string; label: string }> = {
  caution: { fill: "#f59e0b", label: "Caution" },
  dangerous: { fill: "#dc2626", label: "Dangerous" },
};

function buildFlagIcon(fill: string): L.DivIcon {
  // Drawn inline rather than pulled from an icon set: it's two shapes, and a
  // hazard marker shouldn't depend on a font or sprite sheet loading.
  return L.divIcon({
    className: "",
    html: `<svg width="${FLAG_SIZE_PX}" height="${FLAG_SIZE_PX}" viewBox="0 0 24 24" fill="none"
        style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.55));">
      <path d="M6 22V3" stroke="#1f2937" stroke-width="2" stroke-linecap="round"/>
      <path d="M7 3.5h11.5l-3 4 3 4H7z" fill="${fill}" stroke="#1f2937" stroke-width="1.2"
        stroke-linejoin="round"/>
    </svg>`,
    iconSize: [FLAG_SIZE_PX, FLAG_SIZE_PX],
    // Anchor at the foot of the pole, so the flag stands on the ledge.
    iconAnchor: [FLAG_SIZE_PX / 2, FLAG_SIZE_PX],
  });
}

interface DangerFlagsProps {
  ledges: Ledge[];
  /** condition at the currently-selected hour, keyed by ledgeId. */
  conditionsByLedgeId: Map<string, LedgeCondition>;
}

/**
 * Flies a flag on any ledge the wave-runup model rates caution or dangerous
 * for the selected hour. This is deliberately independent of the Fishing
 * Condition colour underneath it: the best fishing and the worst safety
 * often coincide on a rock ledge, so the two readings must never be
 * collapsed into one scale.
 */
export function DangerFlags({ ledges, conditionsByLedgeId }: DangerFlagsProps) {
  const map = useMap();
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!map.getPane(PANE_NAME)) {
      const pane = map.createPane(PANE_NAME);
      pane.style.zIndex = PANE_Z_INDEX;
      pane.style.pointerEvents = "none";
    }

    const markers: L.Marker[] = [];
    for (const ledge of ledges) {
      const tier = conditionsByLedgeId.get(ledge.id)?.dangerTier;
      if (!tier) continue;
      const style = TIER_STYLE[tier];
      if (!style) continue; // "normal" flies nothing.

      // Stand the flag on the water's edge where one is known, matching the
      // shoreline the colour is painted along.
      const position: [number, number] =
        ledge.shoreLat !== null && ledge.shoreLon !== null
          ? [ledge.shoreLat, ledge.shoreLon]
          : [ledge.lat, ledge.lon];

      const marker = L.marker(position, {
        icon: buildFlagIcon(style.fill),
        pane: PANE_NAME,
        interactive: false,
        keyboard: false,
      });
      marker.addTo(map);
      markers.push(marker);
    }
    markersRef.current = markers;

    return () => {
      for (const marker of markers) marker.remove();
      markersRef.current = [];
    };
  }, [map, ledges, conditionsByLedgeId]);

  return null;
}
