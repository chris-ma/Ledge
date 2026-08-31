import { describe, expect, it } from "vitest";
import { destinationPoint, distanceKm } from "./geo";

describe("destinationPoint", () => {
  it("moving north (bearing 0) increases latitude, leaves longitude ~unchanged", () => {
    const { lat, lon } = destinationPoint(-33.8, 151.28, 0, 10);
    expect(lat).toBeGreaterThan(-33.8);
    expect(lon).toBeCloseTo(151.28, 1);
  });

  it("moving east (bearing 90) increases longitude, leaves latitude ~unchanged", () => {
    const { lat, lon } = destinationPoint(-33.8, 151.28, 90, 10);
    expect(lon).toBeGreaterThan(151.28);
    expect(lat).toBeCloseTo(-33.8, 1);
  });

  it("a larger distance moves the point further than a smaller one, same bearing", () => {
    const near = destinationPoint(-33.8, 151.28, 90, 5);
    const far = destinationPoint(-33.8, 151.28, 90, 20);
    expect(far.lon).toBeGreaterThan(near.lon);
  });

  it("10km at Sydney's latitude is roughly 0.09 degrees of longitude", () => {
    // 1 degree of longitude at lat -33.8 is ~cos(33.8deg)*111.32km ~= 92.5km
    const { lon } = destinationPoint(-33.8, 151.28, 90, 10);
    expect(lon - 151.28).toBeCloseTo(10 / 92.5, 1);
  });
});

describe("distanceKm", () => {
  it("is zero for the same point", () => {
    expect(distanceKm(-33.8, 151.28, -33.8, 151.28)).toBeCloseTo(0, 6);
  });

  it("round-trips with destinationPoint", () => {
    const dest = destinationPoint(-33.8, 151.28, 90, 8);
    expect(distanceKm(-33.8, 151.28, dest.lat, dest.lon)).toBeCloseTo(8, 1);
  });

  it("is symmetric", () => {
    const a = distanceKm(-33.8, 151.28, -33.85, 151.3);
    const b = distanceKm(-33.85, 151.3, -33.8, 151.28);
    expect(a).toBeCloseTo(b, 6);
  });
});
