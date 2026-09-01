import { describe, expect, it } from "vitest";
import {
  assignCoastlineToLedges,
  buildOverpassQuery,
  parseOverpassCoastline,
  snapLedgesToCoastline,
  type LedgeAnchor,
} from "./coastline.js";

const NORTH_HEAD: LedgeAnchor = { id: "north-head", lat: -33.815, lon: 151.301 };
const FAIRY_BOWER: LedgeAnchor = { id: "fairy-bower", lat: -33.8008, lon: 151.2944 };

describe("buildOverpassQuery", () => {
  it("emits one around-clause per ledge at the given radius", () => {
    const query = buildOverpassQuery([NORTH_HEAD, FAIRY_BOWER], 2500);
    expect(query).toContain(`way["natural"="coastline"](around:2500,-33.815,151.301);`);
    expect(query).toContain(`way["natural"="coastline"](around:2500,-33.8008,151.2944);`);
    expect(query).toContain("out geom;");
  });
});

describe("parseOverpassCoastline", () => {
  it("extracts each way's vertices", () => {
    const ways = parseOverpassCoastline({
      elements: [
        {
          type: "way",
          geometry: [
            { lat: -33.81, lon: 151.3 },
            { lat: -33.811, lon: 151.301 },
          ],
        },
      ],
    });
    expect(ways).toEqual([
      [
        [-33.81, 151.3],
        [-33.811, 151.301],
      ],
    ]);
  });

  it("drops ways with fewer than two vertices", () => {
    const ways = parseOverpassCoastline({
      elements: [{ type: "way", geometry: [{ lat: -33.81, lon: 151.3 }] }],
    });
    expect(ways).toEqual([]);
  });

  it("ignores elements with no geometry (e.g. bare node refs)", () => {
    const ways = parseOverpassCoastline({ elements: [{ type: "node", id: 1 }] });
    expect(ways).toEqual([]);
  });

  it("throws on a response that isn't an Overpass result", () => {
    expect(() => parseOverpassCoastline({ error: "rate limited" })).toThrow(/Unexpected Overpass/);
  });
});

describe("assignCoastlineToLedges", () => {
  it("gives a run to the nearest ledge", () => {
    const way: [number, number][] = [
      [-33.8150, 151.3015],
      [-33.8151, 151.3016],
      [-33.8152, 151.3017],
    ];
    const runs = assignCoastlineToLedges([way], [NORTH_HEAD, FAIRY_BOWER], 2.5, 0);
    expect(runs).toHaveLength(1);
    expect(runs[0].ledgeId).toBe("north-head");
    expect(runs[0].path).toHaveLength(3);
  });

  it("drops nodes beyond every ledge's reach", () => {
    // ~40km south of both ledges.
    const way: [number, number][] = [
      [-34.2, 151.3],
      [-34.201, 151.301],
    ];
    expect(assignCoastlineToLedges([way], [NORTH_HEAD, FAIRY_BOWER], 2.5, 0)).toEqual([]);
  });

  it("splits into separate runs where the nearest ledge changes", () => {
    const way: [number, number][] = [
      [-33.8150, 151.3010], // nearest North Head
      [-33.8100, 151.2990],
      [-33.8010, 151.2945], // nearest Fairy Bower
      [-33.8008, 151.2944],
    ];
    const runs = assignCoastlineToLedges([way], [NORTH_HEAD, FAIRY_BOWER], 2.5, 0);
    expect(runs.length).toBeGreaterThanOrEqual(2);
    expect(new Set(runs.map((r) => r.ledgeId))).toEqual(new Set(["north-head", "fairy-bower"]));
  });

  it("never joins two separate ways into one run", () => {
    const wayA: [number, number][] = [
      [-33.8150, 151.3015],
      [-33.8151, 151.3016],
    ];
    const wayB: [number, number][] = [
      [-33.8155, 151.3020],
      [-33.8156, 151.3021],
    ];
    const runs = assignCoastlineToLedges([wayA, wayB], [NORTH_HEAD], 2.5, 0);
    expect(runs).toHaveLength(2);
  });

  it("thins vertices below the minimum spacing but keeps the endpoints", () => {
    // Five vertices ~2m apart; at 15m spacing only the endpoints survive.
    const way: [number, number][] = [
      [-33.8150, 151.30150],
      [-33.8150, 151.301502],
      [-33.8150, 151.301504],
      [-33.8150, 151.301506],
      [-33.8150, 151.301508],
    ];
    const runs = assignCoastlineToLedges([way], [NORTH_HEAD], 2.5, 15);
    expect(runs[0].path).toEqual([way[0], way[4]]);
  });

  it("drops a run left with a single point", () => {
    const way: [number, number][] = [
      [-33.8150, 151.3015],
      [-34.2, 151.3], // out of reach, ends the run after one node
    ];
    expect(assignCoastlineToLedges([way], [NORTH_HEAD], 2.5, 0)).toEqual([]);
  });
});

describe("snapLedgesToCoastline", () => {
  it("snaps each ledge to its nearest coastline vertex", () => {
    const way: [number, number][] = [
      [-33.8149, 151.3060],
      [-33.8000, 151.2950],
    ];
    const snapped = snapLedgesToCoastline([way], [NORTH_HEAD, FAIRY_BOWER], 2.5);
    expect(snapped.get("north-head")).toEqual({ lat: -33.8149, lon: 151.306 });
    expect(snapped.get("fairy-bower")).toEqual({ lat: -33.8, lon: 151.295 });
  });

  it("leaves out a ledge with no coastline within range", () => {
    const way: [number, number][] = [
      [-34.5, 151.3],
      [-34.501, 151.301],
    ];
    expect(snapLedgesToCoastline([way], [NORTH_HEAD], 2.5).has("north-head")).toBe(false);
  });
});
