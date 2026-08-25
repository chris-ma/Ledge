import { describe, expect, it } from "vitest";
import {
  angleDiffDeg,
  computeCurrentLoad,
  computeLli,
  computeLliForHour,
  computeTideModulationFactor,
  computeWaveLoad,
  directionalClamp,
} from "./lli";

describe("angleDiffDeg", () => {
  it("returns 0 for identical bearings", () => {
    expect(angleDiffDeg(90, 90)).toBe(0);
  });

  it("wraps around 360", () => {
    expect(angleDiffDeg(350, 10)).toBeCloseTo(20);
  });

  it("caps at 180 for opposite bearings", () => {
    expect(angleDiffDeg(0, 180)).toBe(180);
  });
});

describe("directionalClamp", () => {
  it("is 1 for a square-on angle", () => {
    expect(directionalClamp(0)).toBeCloseTo(1);
  });

  it("is ~0 at exactly 90 degrees", () => {
    expect(directionalClamp(90)).toBeCloseTo(0, 10);
  });

  it("clamps to 0 beyond 90 degrees rather than going negative", () => {
    expect(directionalClamp(150)).toBe(0);
    expect(directionalClamp(179)).toBe(0);
  });
});

describe("computeWaveLoad", () => {
  it("gets the full Hs^2 * Tp when swell is square onto the ledge", () => {
    expect(computeWaveLoad(2, 10, 90, 90)).toBeCloseTo(2 ** 2 * 10);
  });

  it("gets ~0 when swell direction is 90deg off facing_bearing", () => {
    expect(computeWaveLoad(2, 10, 0, 90)).toBeCloseTo(0, 5);
  });
});

describe("computeCurrentLoad", () => {
  it("matches 0.5 * rho * v^2 when square-on", () => {
    expect(computeCurrentLoad(1, 45, 45)).toBeCloseTo(0.5 * 1025 * 1);
  });
});

describe("computeTideModulationFactor", () => {
  it("peaks near the target tide height for a given platform height", () => {
    // platform 4m -> target = 0.5 * 4 * 100 = 200cm
    const atTarget = computeTideModulationFactor(200, 0, 4);
    const wellBelow = computeTideModulationFactor(20, 0, 4);
    const wellAbove = computeTideModulationFactor(380, 0, 4);
    expect(atTarget).toBeGreaterThan(wellBelow);
    expect(atTarget).toBeGreaterThan(wellAbove);
  });

  it("boosts (but never inverts) the factor for a fast rate of change", () => {
    const still = computeTideModulationFactor(200, 0, 4);
    const moving = computeTideModulationFactor(200, 30, 4);
    expect(moving).toBeGreaterThan(still);
  });
});

describe("computeLli", () => {
  it("clamps to the 0-100 range", () => {
    expect(computeLli(0, 0, 1)).toBe(0);
    expect(computeLli(1e9, 1e9, 1)).toBeLessThanOrEqual(100);
  });
});

describe("computeLliForHour", () => {
  const baseInputs = {
    hsM: 2,
    tpS: 10,
    swellDirDeg: 90,
    currentSpeedMs: 0.3,
    currentDirDeg: 90,
    tideHeightCm: 150,
    tideRateCmPerHr: 5,
    facingBearingDeg: 90,
    platformHeightM: 4,
  };

  it("computes a result when all inputs are present", () => {
    const result = computeLliForHour(baseInputs);
    expect(result).not.toBeNull();
    expect(result!.lli).toBeGreaterThan(0);
  });

  it("returns null when any required input is missing", () => {
    expect(computeLliForHour({ ...baseInputs, hsM: null })).toBeNull();
    expect(computeLliForHour({ ...baseInputs, tideHeightCm: null })).toBeNull();
  });
});
