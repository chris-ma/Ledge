import { describe, expect, it } from "vitest";
import { getMoonPhase } from "./moonPhase";

const REFERENCE_NEW_MOON = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
const SYNODIC_MONTH_DAYS = 29.53058867;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function daysAfterReference(days: number): Date {
  return new Date(REFERENCE_NEW_MOON.getTime() + days * ONE_DAY_MS);
}

describe("getMoonPhase", () => {
  it("is new (phase 0, dark) exactly at the reference new moon", () => {
    const { phase, illumination } = getMoonPhase(REFERENCE_NEW_MOON);
    expect(phase).toBeCloseTo(0, 5);
    expect(illumination).toBeCloseTo(0, 5);
  });

  it("is full (phase 0.5, fully lit) at the midpoint of the cycle", () => {
    const { phase, illumination } = getMoonPhase(daysAfterReference(SYNODIC_MONTH_DAYS / 2));
    expect(phase).toBeCloseTo(0.5, 2);
    expect(illumination).toBeGreaterThan(0.99);
  });

  it("wraps back to ~new after a full synodic month", () => {
    // Constructing an exact fraction-of-a-day offset through a
    // millisecond-precision Date can land phase infinitesimally on either
    // side of the 0/1 wrap boundary — compare distance-from-new rather than
    // a direct closeTo(0), which would spuriously fail on a phase of ~0.9999.
    const { phase, illumination } = getMoonPhase(daysAfterReference(SYNODIC_MONTH_DAYS));
    const distanceFromNew = Math.min(phase, 1 - phase);
    expect(distanceFromNew).toBeLessThan(0.01);
    expect(illumination).toBeLessThan(0.01);
  });

  it("wraps correctly for a date before the reference new moon", () => {
    const { phase, illumination } = getMoonPhase(daysAfterReference(-SYNODIC_MONTH_DAYS / 4));
    // A quarter-cycle before a new moon is the same as three-quarters after one.
    expect(phase).toBeCloseTo(0.75, 3);
    expect(illumination).toBeCloseTo(0.5, 3);
  });

  it("illumination rises from new toward full over the first half of the cycle", () => {
    const early = getMoonPhase(daysAfterReference(3));
    const later = getMoonPhase(daysAfterReference(10));
    expect(later.illumination).toBeGreaterThan(early.illumination);
  });

  it("illumination falls from full back toward new over the second half of the cycle", () => {
    const early = getMoonPhase(daysAfterReference(SYNODIC_MONTH_DAYS / 2 + 3));
    const later = getMoonPhase(daysAfterReference(SYNODIC_MONTH_DAYS / 2 + 10));
    expect(later.illumination).toBeLessThan(early.illumination);
  });

  it("returns one of the 8 phase emoji", () => {
    const { emoji } = getMoonPhase(daysAfterReference(15));
    expect(["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"]).toContain(emoji);
  });

  it("shows the new-moon emoji right at the reference new moon", () => {
    expect(getMoonPhase(REFERENCE_NEW_MOON).emoji).toBe("🌑");
  });

  it("shows the full-moon emoji solidly inside the full-moon bucket", () => {
    // +1 day past the exact midpoint, clear of the floating-point noise a
    // fraction-of-a-day offset can land right on the bucket boundary with.
    expect(getMoonPhase(daysAfterReference(SYNODIC_MONTH_DAYS / 2 + 1)).emoji).toBe("🌕");
  });
});
