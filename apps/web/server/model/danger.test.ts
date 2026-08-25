import { describe, expect, it } from "vitest";
import {
  computeDangerSeries,
  computeDeepWaterWavelength,
  computeStockdonR2,
  trailingDelta,
} from "./danger";

describe("computeDeepWaterWavelength", () => {
  it("matches g*Tp^2/(2*pi) for a 10s period", () => {
    expect(computeDeepWaterWavelength(10)).toBeCloseTo((9.81 * 100) / (2 * Math.PI), 2);
  });
});

describe("computeStockdonR2", () => {
  it("matches a hand-computed value for Hs=2, Tp=10, tanBeta=0.1", () => {
    // L0 = 9.81*100/(2*pi) ~= 156.13
    // setup = 0.35*0.1*sqrt(2*156.13) ~= 0.6185
    // swash = sqrt(2*156.13*(0.563*0.01+0.004)) ~= 1.7341
    // R2 = 1.1*(0.6185 + 1.7341/2) ~= 1.634
    expect(computeStockdonR2(2, 10, 0.1)).toBeCloseTo(1.634, 2);
  });

  it("increases with wave height", () => {
    expect(computeStockdonR2(3, 10, 0.1)).toBeGreaterThan(computeStockdonR2(1, 10, 0.1));
  });
});

describe("trailingDelta", () => {
  it("returns the difference when both points exist", () => {
    expect(trailingDelta([10, 11, 12, 15], 3, 2)).toBe(4);
  });

  it("returns null when the lookback index is out of range", () => {
    expect(trailingDelta([10, 11], 1, 5)).toBeNull();
  });

  it("returns null when either point is null", () => {
    expect(trailingDelta([null, 11, 12], 2, 2)).toBeNull();
  });
});

describe("computeDangerSeries", () => {
  // threshold = platformHeightM(2) * safetyMargin(0.7) = 1.4m; caution = 1.05m
  const ledge = { platformHeightM: 2, safetyMargin: 0.7, slopeEstimate: 0.1 };

  it("flags dangerous when R2 exceeds the threshold", () => {
    const [result] = computeDangerSeries(ledge, [{ hsM: 4, tpS: 14, tideRateCmPerHr: 0 }], 3);
    expect(result.dangerTier).toBe("dangerous");
    expect(result.dangerFlag).toBe(true);
  });

  it("stays normal for small, short-period swell", () => {
    const [result] = computeDangerSeries(ledge, [{ hsM: 0.3, tpS: 6, tideRateCmPerHr: 0 }], 3);
    expect(result.dangerTier).toBe("normal");
    expect(result.dangerFlag).toBe(false);
  });

  it("escalates to dangerous on a sharp period rise even under the R2 threshold", () => {
    const hours = [
      { hsM: 0.3, tpS: 6, tideRateCmPerHr: 0 },
      { hsM: 0.3, tpS: 6.5, tideRateCmPerHr: 0 },
      { hsM: 0.3, tpS: 7, tideRateCmPerHr: 0 },
      { hsM: 0.3, tpS: 9, tideRateCmPerHr: 0 }, // +3s vs hour 0, over the 2s sharp-rise threshold
    ];
    const results = computeDangerSeries(ledge, hours, 3);
    expect(results[3].dangerTier).toBe("dangerous");
  });

  it("returns nulls when hs or tp is missing", () => {
    const [result] = computeDangerSeries(ledge, [{ hsM: null, tpS: 10, tideRateCmPerHr: 0 }], 3);
    expect(result.r2EstimateM).toBeNull();
    expect(result.dangerTier).toBeNull();
    expect(result.dangerFlag).toBeNull();
  });
});
