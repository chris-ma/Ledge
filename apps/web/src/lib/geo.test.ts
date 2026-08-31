import { describe, expect, it } from "vitest";
import { distanceKm } from "./geo";

describe("distanceKm", () => {
  it("is zero for the same point", () => {
    expect(distanceKm(-33.8, 151.28, -33.8, 151.28)).toBeCloseTo(0, 6);
  });

  it("matches a known reference distance", () => {
    // ~10km due east at lat -33.8 (1 degree lon there is ~92.5km).
    expect(distanceKm(-33.8, 151.28, -33.8, 151.28 + 10 / 92.5)).toBeCloseTo(10, 0);
  });

  it("is symmetric", () => {
    const a = distanceKm(-33.8, 151.28, -33.85, 151.3);
    const b = distanceKm(-33.85, 151.3, -33.8, 151.28);
    expect(a).toBeCloseTo(b, 6);
  });

  it("a larger longitude offset gives a larger distance, same latitude", () => {
    const near = distanceKm(-33.8, 151.28, -33.8, 151.29);
    const far = distanceKm(-33.8, 151.28, -33.8, 151.35);
    expect(far).toBeGreaterThan(near);
  });
});
