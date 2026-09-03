import { describe, expect, it } from "vitest";
import { localFishingCondition } from "./fishingLocal";
import type { LedgeCondition } from "./types";

function condition(overrides: Partial<LedgeCondition> = {}): LedgeCondition {
  return {
    ledgeId: "l1",
    ts: "2026-09-01T05:00:00.000Z",
    hsM: 1.5,
    tpS: 10,
    swellDirDeg: 90,
    currentSpeedMs: 0,
    currentDirDeg: 90,
    tideHeightCm: 50,
    tideRateCmPerHr: 5,
    windSpeedMs: null,
    windDirDeg: null,
    waveLoad: null,
    currentLoad: null,
    tideModulationFactor: null,
    lli: null,
    r2EstimateM: null,
    dangerFlag: false,
    dangerTier: "normal",
    tideCurrentSpeedMs: 0.03,
    tideCurrentDirDeg: 270,
    fishingPressure: null,
    fishingTier: null,
    dataComplete: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("localFishingCondition", () => {
  it("scores highest where the tide runs straight onto the shore", () => {
    // Current from the west (270) onto a west-facing stretch.
    const facing = localFishingCondition(condition(), 270, true);
    const away = localFishingCondition(condition(), 90, true);
    expect(facing).toBe(100);
    expect(away).toBe(0);
  });

  it("gives the same hour different scores for different aspects", () => {
    // This is the whole point: one ledge's stretch of coast is not one colour.
    const c = condition();
    const west = localFishingCondition(c, 270, false);
    const east = localFishingCondition(c, 90, false);
    expect(west).not.toBe(east);
  });

  it("flips which aspect wins when the tide reverses", () => {
    const ebb = condition({ tideCurrentDirDeg: 270 });
    const flood = condition({ tideCurrentDirDeg: 90 });
    const westOnEbb = localFishingCondition(ebb, 270, true)!;
    const westOnFlood = localFishingCondition(flood, 270, true)!;
    const eastOnEbb = localFishingCondition(ebb, 90, true)!;
    const eastOnFlood = localFishingCondition(flood, 90, true)!;

    expect(westOnEbb).toBeGreaterThan(eastOnEbb);
    expect(eastOnFlood).toBeGreaterThan(westOnFlood);
  });

  it("counts swell on an exposed ledge but not a sheltered one", () => {
    // Swell from the east onto an east-facing stretch, no tide current.
    const c = condition({ tideCurrentSpeedMs: 0, swellDirDeg: 90 });
    const exposed = localFishingCondition(c, 90, false)!;
    const sheltered = localFishingCondition(c, 90, true)!;
    expect(exposed).toBeGreaterThan(sheltered);
    expect(sheltered).toBe(0);
  });

  it("ignores swell arriving from behind the shore's aspect", () => {
    const c = condition({ tideCurrentSpeedMs: 0, swellDirDeg: 90 });
    expect(localFishingCondition(c, 270, false)).toBe(0);
  });

  it("returns null rather than zero when the tide vector is missing", () => {
    const c = condition({ tideCurrentSpeedMs: null, tideCurrentDirDeg: null });
    expect(localFishingCondition(c, 90, true)).toBeNull();
  });

  it("falls back to a tide-only score for an exposed ledge with no swell reading", () => {
    // Tide from the west (270) onto a west-facing stretch, swell missing.
    const c = condition({ hsM: null, tpS: null, swellDirDeg: null, tideCurrentDirDeg: 270 });
    expect(localFishingCondition(c, 270, false)).toBe(100);
  });

  it("falls back to a swell-only score for an exposed ledge with no tide reading", () => {
    // Swell from the east (90) onto an east-facing stretch, tide missing.
    const c = condition({ tideCurrentSpeedMs: null, tideCurrentDirDeg: null, swellDirDeg: 90 });
    expect(localFishingCondition(c, 90, false)).toBeGreaterThan(0);
  });

  it("returns null for an exposed ledge with neither tide nor swell", () => {
    const c = condition({
      hsM: null,
      tpS: null,
      swellDirDeg: null,
      tideCurrentSpeedMs: null,
      tideCurrentDirDeg: null,
    });
    expect(localFishingCondition(c, 90, false)).toBeNull();
  });

  it("still scores a sheltered ledge with no swell reading", () => {
    const c = condition({ hsM: null, tpS: null, swellDirDeg: null });
    expect(localFishingCondition(c, 270, true)).toBe(100);
  });

  it("stays within 0-100", () => {
    const c = condition({ hsM: 8, tpS: 20, swellDirDeg: 90, tideCurrentSpeedMs: 5 });
    const score = localFishingCondition(c, 90, false)!;
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
