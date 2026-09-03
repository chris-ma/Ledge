import { describe, expect, it } from "vitest";
import { componentsToBearing, interpolateWindField, windToComponents, type WindSample } from "./windField";

describe("windToComponents / componentsToBearing round-trip", () => {
  it("a northerly (blowing from north) points toward south", () => {
    const { u, v } = windToComponents(10, 0);
    expect(u).toBeCloseTo(0, 5);
    expect(v).toBeCloseTo(-10, 5);
    expect(componentsToBearing(u, v)).toBeCloseTo(180, 5);
  });

  it("an easterly (blowing from east) points toward west", () => {
    const { u, v } = windToComponents(10, 90);
    expect(u).toBeCloseTo(-10, 5);
    expect(v).toBeCloseTo(0, 5);
    expect(componentsToBearing(u, v)).toBeCloseTo(270, 5);
  });

  it("round-trips speed+direction through components and back to the same bearing", () => {
    for (const dir of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const { u, v } = windToComponents(7, dir);
      const toBearing = componentsToBearing(u, v);
      expect(toBearing).toBeCloseTo((dir + 180) % 360, 5);
    }
  });
});

describe("interpolateWindField", () => {
  it("returns null with no samples", () => {
    expect(interpolateWindField([], -33.8, 151.2)).toBeNull();
  });

  it("matches a single sample's value everywhere (nothing else to blend with)", () => {
    const samples: WindSample[] = [{ lat: -33.8, lon: 151.2, u: 3, v: 4 }];
    const far = interpolateWindField(samples, -33.9, 151.3)!;
    expect(far.u).toBeCloseTo(3, 5);
    expect(far.v).toBeCloseTo(4, 5);
    expect(far.speed).toBeCloseTo(5, 5); // 3-4-5 triangle
  });

  it("is close to a sample's own value very near that sample", () => {
    const samples: WindSample[] = [
      { lat: -33.8, lon: 151.2, u: 10, v: 0 },
      { lat: -34.0, lon: 151.4, u: -10, v: 0 },
    ];
    const near = interpolateWindField(samples, -33.8001, 151.2001)!;
    expect(near.u).toBeGreaterThan(9);
  });

  it("blends two equidistant samples to roughly their average", () => {
    const samples: WindSample[] = [
      { lat: -33.8, lon: 151.2, u: 10, v: 0 },
      { lat: -33.8, lon: 151.22, u: -10, v: 0 },
    ];
    // The midpoint is equidistant from both, so IDW weights them equally.
    const mid = interpolateWindField(samples, -33.8, 151.21)!;
    expect(mid.u).toBeCloseTo(0, 1);
  });

  it("weights the closer sample more heavily than the farther one", () => {
    const samples: WindSample[] = [
      { lat: -33.8, lon: 151.2, u: 10, v: 0 },
      { lat: -34.5, lon: 152.0, u: -10, v: 0 },
    ];
    const closeToFirst = interpolateWindField(samples, -33.81, 151.21)!;
    expect(closeToFirst.u).toBeGreaterThan(5);
  });
});
