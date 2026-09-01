import { describe, expect, it } from "vitest";
import {
  assignCoastlineToLedges,
  buildOverpassQuery,
  computeVertexBearings,
  filterShorelineWays,
  parseOverpassCoastline,
  snapLedgesToCoastline,
  type LedgeAnchor,
} from "./coastline.js";

const NORTH_HEAD: LedgeAnchor = { id: "north-head", lat: -33.815, lon: 151.301, facingBearing: 75 };
const FAIRY_BOWER: LedgeAnchor = { id: "fairy-bower", lat: -33.8008, lon: 151.2944, facingBearing: 23 };

describe("buildOverpassQuery", () => {
  it("emits a coastline around-clause per ledge at the given radius", () => {
    const query = buildOverpassQuery([NORTH_HEAD, FAIRY_BOWER], 2500);
    expect(query).toContain(`way["natural"="coastline"](around:2500,-33.815,151.301);`);
    expect(query).toContain(`way["natural"="coastline"](around:2500,-33.8008,151.2944);`);
    expect(query).toContain("out geom;");
  });

  it("also asks for water areas, which is how the inner harbour is mapped", () => {
    const query = buildOverpassQuery([NORTH_HEAD], 2500);
    expect(query).toContain(`way["natural"="water"](around:2500,-33.815,151.301);`);
    expect(query).toContain(`relation["natural"="water"](around:2500,-33.815,151.301);`);
  });
});

describe("parseOverpassCoastline", () => {
  it("extracts each way's vertices and flags coastline ways", () => {
    const ways = parseOverpassCoastline({
      elements: [
        {
          type: "way",
          tags: { natural: "coastline" },
          geometry: [
            { lat: -33.81, lon: 151.3 },
            { lat: -33.811, lon: 151.301 },
          ],
        },
      ],
    });
    expect(ways).toEqual([
      {
        isCoastline: true,
        path: [
          [-33.81, 151.3],
          [-33.811, 151.301],
        ],
      },
    ]);
  });

  it("flags water areas as non-coastline", () => {
    const ways = parseOverpassCoastline({
      elements: [
        {
          type: "way",
          tags: { natural: "water" },
          geometry: [
            { lat: -33.81, lon: 151.3 },
            { lat: -33.811, lon: 151.301 },
          ],
        },
      ],
    });
    expect(ways[0].isCoastline).toBe(false);
  });

  it("reads a relation's member geometry", () => {
    const ways = parseOverpassCoastline({
      elements: [
        {
          type: "relation",
          tags: { natural: "water" },
          members: [
            {
              type: "way",
              geometry: [
                { lat: -33.85, lon: 151.24 },
                { lat: -33.851, lon: 151.241 },
              ],
            },
          ],
        },
      ],
    });
    expect(ways).toHaveLength(1);
    expect(ways[0].path).toHaveLength(2);
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

describe("filterShorelineWays", () => {
  const tiny: [number, number][] = [
    [-33.8500, 151.2400],
    [-33.8502, 151.2402], // ~30m across
  ];
  const big: [number, number][] = [
    [-33.8500, 151.2400],
    [-33.8560, 151.2470], // ~900m across
  ];

  it("keeps a large water ring", () => {
    expect(filterShorelineWays([{ path: big, isCoastline: false }], 300)).toEqual([big]);
  });

  it("drops a pond-sized water ring", () => {
    expect(filterShorelineWays([{ path: tiny, isCoastline: false }], 300)).toEqual([]);
  });

  it("keeps a short coastline fragment regardless of size", () => {
    expect(filterShorelineWays([{ path: tiny, isCoastline: true }], 300)).toEqual([tiny]);
  });
});

describe("computeVertexBearings", () => {
  it("faces east off a north-south shore when the ledge faces east", () => {
    // Shore running due north; seaward is east (90).
    const path: [number, number][] = [
      [-33.8200, 151.3000],
      [-33.8190, 151.3000],
      [-33.8180, 151.3000],
    ];
    for (const b of computeVertexBearings(path, 90)) {
      expect(b).toBeCloseTo(90, 0);
    }
  });

  it("faces west off the same shore when the ledge faces west", () => {
    const path: [number, number][] = [
      [-33.8200, 151.3000],
      [-33.8190, 151.3000],
      [-33.8180, 151.3000],
    ];
    for (const b of computeVertexBearings(path, 270)) {
      expect(b).toBeCloseTo(270, 0);
    }
  });

  it("turns with the shore around a corner", () => {
    // North up the coast, then east: aspect should swing from east to south.
    const path: [number, number][] = [
      [-33.8200, 151.3000],
      [-33.8190, 151.3000],
      [-33.8190, 151.3020],
      [-33.8190, 151.3040],
    ];
    const bearings = computeVertexBearings(path, 90);
    expect(bearings[0]).toBeCloseTo(90, 0);
    expect(bearings[bearings.length - 1]).toBeCloseTo(180, 0);
  });

  it("returns one bearing per vertex", () => {
    const path: [number, number][] = [
      [-33.8200, 151.3000],
      [-33.8190, 151.3000],
      [-33.8180, 151.3000],
      [-33.8170, 151.3000],
    ];
    expect(computeVertexBearings(path, 90)).toHaveLength(4);
  });

  it("handles a two-vertex run", () => {
    const path: [number, number][] = [
      [-33.8200, 151.3000],
      [-33.8190, 151.3000],
    ];
    const bearings = computeVertexBearings(path, 90);
    expect(bearings).toHaveLength(2);
    expect(bearings[0]).toBeCloseTo(90, 0);
  });
});

describe("assignCoastlineToLedges", () => {
  it("attaches a bearing to every vertex of every run", () => {
    const way: [number, number][] = [
      [-33.8150, 151.3015],
      [-33.8151, 151.3016],
      [-33.8152, 151.3017],
    ];
    const runs = assignCoastlineToLedges([way], [NORTH_HEAD], 2.5, 0);
    expect(runs[0].bearings).toHaveLength(runs[0].path.length);
  });

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
    // Walks North Head -> Fairy Bower in ~200m steps, so the run only breaks
    // on the ownership change and not on the large-gap rule.
    const way: [number, number][] = [
      [-33.81500, 151.30100], // nearest North Head
      [-33.81323, 151.30018],
      [-33.81145, 151.29935],
      [-33.80968, 151.29853],
      [-33.80790, 151.29770],
      [-33.80613, 151.29688],
      [-33.80435, 151.29605],
      [-33.80258, 151.29523],
      [-33.80080, 151.29440], // nearest Fairy Bower
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

  it("breaks the run across a polygon's closing edge rather than drawing over water", () => {
    // Two short stretches of real shore with a ~1km hop between them, which
    // is what a bay-mouth closing edge looks like in a water ring.
    const way: [number, number][] = [
      [-33.8150, 151.3010],
      [-33.8151, 151.3011],
      [-33.8230, 151.3020], // ~900m jump
      [-33.8231, 151.3021],
    ];
    const runs = assignCoastlineToLedges([way], [NORTH_HEAD], 2.5, 0, 400);
    expect(runs).toHaveLength(2);
    for (const run of runs) {
      expect(run.path).toHaveLength(2);
    }
  });

  it("keeps a run together when vertices are merely sparse", () => {
    const way: [number, number][] = [
      [-33.8150, 151.3010],
      [-33.8152, 151.3012], // ~30m
      [-33.8154, 151.3014],
    ];
    const runs = assignCoastlineToLedges([way], [NORTH_HEAD], 2.5, 0, 400);
    expect(runs).toHaveLength(1);
    expect(runs[0].path).toHaveLength(3);
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
