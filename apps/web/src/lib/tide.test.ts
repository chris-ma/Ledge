import { describe, expect, it } from "vitest";
import { computeRegionalTideSeries, tideTrend } from "./tide";
import type { LedgeCondition } from "./types";

function makeCondition(overrides: Partial<LedgeCondition>): LedgeCondition {
  return {
    ledgeId: "ledge-1",
    ts: "2026-08-30T00:00:00.000Z",
    hsM: null,
    tpS: null,
    swellDirDeg: null,
    currentSpeedMs: null,
    currentDirDeg: null,
    tideHeightCm: null,
    tideRateCmPerHr: null,
    windSpeedMs: null,
    windDirDeg: null,
    waveLoad: null,
    currentLoad: null,
    tideModulationFactor: null,
    lli: null,
    r2EstimateM: null,
    dangerFlag: null,
    dangerTier: null,
    tideCurrentSpeedMs: null,
    tideCurrentDirDeg: null,
    fishingPressure: null,
    fishingTier: null,
    dataComplete: false,
    createdAt: "2026-08-30T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeRegionalTideSeries", () => {
  const hours = ["2026-08-30T00:00:00.000Z", "2026-08-30T01:00:00.000Z"];

  it("averages tide height and rate across multiple ledges at the same hour", () => {
    const conditions = [
      makeCondition({ ledgeId: "a", ts: hours[0], tideHeightCm: 10, tideRateCmPerHr: 2 }),
      makeCondition({ ledgeId: "b", ts: hours[0], tideHeightCm: 30, tideRateCmPerHr: 4 }),
    ];
    const series = computeRegionalTideSeries(conditions, hours);
    expect(series[0]).toEqual({ ts: hours[0], heightCm: 20, rateCmPerHr: 3 });
  });

  it("returns null for an hour with no tide data at all", () => {
    const series = computeRegionalTideSeries([], hours);
    expect(series[1]).toEqual({ ts: hours[1], heightCm: null, rateCmPerHr: null });
  });

  it("ignores nulls from individual ledges rather than treating them as 0", () => {
    const conditions = [
      makeCondition({ ledgeId: "a", ts: hours[0], tideHeightCm: 40, tideRateCmPerHr: null }),
      makeCondition({ ledgeId: "b", ts: hours[0], tideHeightCm: null, tideRateCmPerHr: 6 }),
    ];
    const series = computeRegionalTideSeries(conditions, hours);
    expect(series[0]).toEqual({ ts: hours[0], heightCm: 40, rateCmPerHr: 6 });
  });

  it("preserves hour order and count even with unrelated conditions present", () => {
    const conditions = [makeCondition({ ts: "2026-09-01T00:00:00.000Z", tideHeightCm: 99 })];
    const series = computeRegionalTideSeries(conditions, hours);
    expect(series.map((p) => p.ts)).toEqual(hours);
    expect(series.every((p) => p.heightCm === null)).toBe(true);
  });
});

describe("tideTrend", () => {
  it("is null when the rate is unknown", () => {
    expect(tideTrend(null)).toBeNull();
  });

  it("is rising for a positive rate above the steady threshold", () => {
    expect(tideTrend(5)).toBe("rising");
  });

  it("is falling for a negative rate below the steady threshold", () => {
    expect(tideTrend(-5)).toBe("falling");
  });

  it.each([0, 0.5, -0.9])("is steady for a near-zero rate (%f)", (rate) => {
    expect(tideTrend(rate)).toBe("steady");
  });
});
