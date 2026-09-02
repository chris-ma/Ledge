import { describe, expect, it } from "vitest";
import {
  FISHING_SWELL_WEIGHT,
  FISHING_TIDE_WEIGHT,
  FISHING_WAVE_LOAD_REF_MAX,
  TIDE_CURRENT_PRESSURE_REF_MAX_MS,
} from "./constants.js";
import {
  computeFishingPressureForHour,
  computeFishingPressureIndex,
  computeFishingPressureIndexSwellOnly,
  computeFishingPressureIndexTideOnly,
  computeTideCurrentDirFromDeg,
  computeTideCurrentSpeedMs,
  computeTidePressure,
  fishingPressureToTier,
} from "./fishingPressure.js";
import { computeWaveLoad } from "./lli.js";

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
    expect(computeFishingPressureIndex(FISHING_WAVE_LOAD_REF_MAX, TIDE_CURRENT_PRESSURE_REF_MAX_MS)).toBe(100);
  });

  it("weights each term by its configured share", () => {
    // swell at half its ref max, tide at zero -> swellWeight * 0.5 * 100
    expect(computeFishingPressureIndex(FISHING_WAVE_LOAD_REF_MAX / 2, 0)).toBe(
      Math.round(FISHING_SWELL_WEIGHT * 0.5 * 100),
    );
  });

  it("weighs tide above swell", () => {
    // Same fractional distance toward each term's own reference max, tide
    // scores higher purely because it's weighted more heavily.
    const swellOnly = computeFishingPressureIndex(FISHING_WAVE_LOAD_REF_MAX, 0);
    const tideOnly = computeFishingPressureIndex(0, TIDE_CURRENT_PRESSURE_REF_MAX_MS);
    expect(tideOnly).toBeGreaterThan(swellOnly);
    expect(FISHING_TIDE_WEIGHT).toBeGreaterThan(FISHING_SWELL_WEIGHT);
  });
});

describe("computeFishingPressureIndexTideOnly", () => {
  it("is 0 when tide pressure is 0", () => {
    expect(computeFishingPressureIndexTideOnly(0)).toBe(0);
  });

  it("saturates at 100 at/above the tide reference max, unlike the blended formula's 50 cap", () => {
    expect(computeFishingPressureIndexTideOnly(TIDE_CURRENT_PRESSURE_REF_MAX_MS)).toBe(100);
  });

  it("is half at half the reference max", () => {
    expect(computeFishingPressureIndexTideOnly(TIDE_CURRENT_PRESSURE_REF_MAX_MS / 2)).toBe(50);
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

  it.each(["hsM", "tpS", "swellDirDeg"] as const)(
    "falls back to a tide-only result when only %s is missing (swell incomplete, tide present)",
    (key) => {
      const result = computeFishingPressureForHour({ ...baseInputs, [key]: null });
      expect(result).not.toBeNull();
      expect(result?.fishingPressure).toBe(
        computeFishingPressureIndexTideOnly(
          computeTidePressure(
            computeTideCurrentSpeedMs(baseInputs.tideCurrentUCmS, baseInputs.tideCurrentVCmS),
            computeTideCurrentDirFromDeg(baseInputs.tideCurrentUCmS, baseInputs.tideCurrentVCmS),
            baseInputs.facingBearingDeg,
          ),
        ),
      );
    },
  );

  it.each(["tideCurrentUCmS", "tideCurrentVCmS"] as const)(
    "falls back to a swell-only result when only %s is missing (tide incomplete, swell present)",
    (key) => {
      const result = computeFishingPressureForHour({ ...baseInputs, [key]: null });
      expect(result).not.toBeNull();
      expect(result?.tideCurrentSpeedMs).toBeNull();
      expect(result?.tideCurrentDirDeg).toBeNull();
      expect(result?.fishingPressure).toBe(
        computeFishingPressureIndexSwellOnly(
          computeWaveLoad(baseInputs.hsM, baseInputs.tpS, baseInputs.swellDirDeg, baseInputs.facingBearingDeg),
        ),
      );
    },
  );

  it("returns null only when both tide and swell are entirely missing", () => {
    expect(
      computeFishingPressureForHour({
        ...baseInputs,
        hsM: null,
        tpS: null,
        swellDirDeg: null,
        tideCurrentUCmS: null,
        tideCurrentVCmS: null,
      }),
    ).toBeNull();
  });

  describe("sheltered ledges", () => {
    const shelteredInputs = { ...baseInputs, sheltered: true };

    it("returns a result from tide alone when swell fields are null", () => {
      const result = computeFishingPressureForHour({
        ...shelteredInputs,
        hsM: null,
        tpS: null,
        swellDirDeg: null,
      });
      expect(result).not.toBeNull();
      expect(result?.fishingPressure).toBe(
        computeFishingPressureIndexTideOnly(
          computeTidePressure(
            computeTideCurrentSpeedMs(baseInputs.tideCurrentUCmS, baseInputs.tideCurrentVCmS),
            computeTideCurrentDirFromDeg(baseInputs.tideCurrentUCmS, baseInputs.tideCurrentVCmS),
            baseInputs.facingBearingDeg,
          ),
        ),
      );
    });

    it("still returns null when the tide current vector itself is missing", () => {
      expect(
        computeFishingPressureForHour({ ...shelteredInputs, tideCurrentUCmS: null }),
      ).toBeNull();
    });

    it("scores higher than the blended (non-sheltered) formula for the same tide pressure, since it isn't diluted by any swell weight", () => {
      // u=-20,v=0 -> current flows due west, i.e. arrives FROM the east
      // (90deg), squarely onto facingBearingDeg=90 -> nonzero tide pressure.
      const pushingInputs = { ...baseInputs, tideCurrentUCmS: -20, tideCurrentVCmS: 0 };
      const sheltered = computeFishingPressureForHour({ ...pushingInputs, sheltered: true });
      const blendedWithNoSwell = computeFishingPressureForHour({
        ...pushingInputs,
        hsM: 0,
        tpS: 1,
        swellDirDeg: 90,
      });
      expect(sheltered!.fishingPressure).toBeGreaterThan(blendedWithNoSwell!.fishingPressure);
    });
  });
});
