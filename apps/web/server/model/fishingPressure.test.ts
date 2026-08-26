import { describe, expect, it } from "vitest";
import {
  computeFishingPressureForHour,
  computeFishingPressureIndex,
  computeTideCurrentDirFromDeg,
  computeTideCurrentSpeedMs,
  computeTidePressure,
  fishingPressureToTier,
} from "./fishingPressure.js";

describe("computeTideCurrentSpeedMs", () => {
  it("converts a u/v cm/s vector magnitude to m/s", () => {
    // 3-4-5 triangle: sqrt(30^2+40^2) = 50 cm/s = 0.5 m/s
    expect(computeTideCurrentSpeedMs(30, 40)).toBeCloseTo(0.5, 6);
  });

  it("is zero for a zero vector", () => {
    expect(computeTideCurrentSpeedMs(0, 0)).toBe(0);
  });
});

describe("computeTideCurrentDirFromDeg", () => {
  it("a current flowing due north (u=0,v>0) comes FROM the south (180)", () => {
    expect(computeTideCurrentDirFromDeg(0, 10)).toBeCloseTo(180, 6);
  });

  it("a current flowing due east (u>0,v=0) comes FROM the west (270)", () => {
    expect(computeTideCurrentDirFromDeg(10, 0)).toBeCloseTo(270, 6);
  });

  it("a current flowing due south (u=0,v<0) comes FROM the north (0/360)", () => {
    const result = computeTideCurrentDirFromDeg(0, -10);
    expect(result % 360).toBeCloseTo(0, 6);
  });
});

describe("computeTidePressure", () => {
  it("is at its max when the current arrives square onto the facing bearing", () => {
    const pressure = computeTidePressure(0.4, 90, 90);
    expect(pressure).toBeCloseTo(0.4, 6);
  });

  it("is zero when the current arrives 90deg+ off the facing bearing", () => {
    expect(computeTidePressure(0.4, 180, 90)).toBeCloseTo(0, 10);
  });
});

describe("computeFishingPressureIndex", () => {
  it("is 0 when both terms are 0", () => {
    expect(computeFishingPressureIndex(0, 0)).toBe(0);
  });

  it("saturates at 100 when both terms are at/above their reference max", () => {
    expect(computeFishingPressureIndex(200, 0.3)).toBe(100);
  });

  it("blends partial terms evenly (0.5/0.5 weights)", () => {
    // swell at half its ref max, tide at zero -> 0.5 * 0.5 * 100 = 25
    expect(computeFishingPressureIndex(100, 0)).toBe(25);
  });
});

describe("fishingPressureToTier", () => {
  it.each([
    [0, "poor"],
    [24, "poor"],
    [25, "fair"],
    [49, "fair"],
    [50, "good"],
    [74, "good"],
    [75, "great"],
    [100, "great"],
  ] as const)("%i -> %s", (score, tier) => {
    expect(fishingPressureToTier(score)).toBe(tier);
  });
});

describe("computeFishingPressureForHour", () => {
  const baseInputs = {
    hsM: 1.5,
    tpS: 10,
    swellDirDeg: 90,
    tideCurrentUCmS: 20,
    tideCurrentVCmS: 0,
    facingBearingDeg: 90,
  };

  it("returns a full result when every input is present", () => {
    const result = computeFishingPressureForHour(baseInputs);
    expect(result).not.toBeNull();
    expect(result?.fishingTier).toBe(fishingPressureToTier(result!.fishingPressure));
  });

  it.each(["hsM", "tpS", "swellDirDeg", "tideCurrentUCmS", "tideCurrentVCmS"] as const)(
    "returns null when %s is missing",
    (key) => {
      expect(computeFishingPressureForHour({ ...baseInputs, [key]: null })).toBeNull();
    },
  );
});
