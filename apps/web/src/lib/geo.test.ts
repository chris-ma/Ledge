import { describe, expect, it } from "vitest";
import { destinationPoint } from "./geo";

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
    const { lon } = destinationPoint(-33.8, 151.28, 90, 10);
    expect(lon - 151.28).toBeCloseTo(10 / 92.5, 1);
  });
});
