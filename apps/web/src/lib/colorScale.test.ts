import { describe, expect, it } from "vitest";
import { MS_TO_KT, windSpeedColor } from "./colorScale";

// Dividing by the implementation's own MS_TO_KT (rather than an
// independently-rounded knots->m/s constant) round-trips back to exactly
// the target knot value in floating point, so the boundary tests below
// aren't fighting conversion-constant rounding noise.
const KT_TO_MS = 1 / MS_TO_KT;

describe("windSpeedColor", () => {
  it("is green well under 10kt", () => {
    expect(windSpeedColor(2 * KT_TO_MS)).toBe("#22c55e");
  });

  it("is green just under 10kt", () => {
    expect(windSpeedColor(9.9 * KT_TO_MS)).toBe("#22c55e");
  });

  it("is yellow at exactly 10kt (boundary is inclusive on the yellow side)", () => {
    expect(windSpeedColor(10 * KT_TO_MS)).toBe("#eab308");
  });

  it("is yellow in the middle of the 10-15kt band", () => {
    expect(windSpeedColor(12.5 * KT_TO_MS)).toBe("#eab308");
  });

  it("is yellow at exactly 15kt (boundary is inclusive on the yellow side)", () => {
    expect(windSpeedColor(15 * KT_TO_MS)).toBe("#eab308");
  });

  it("is red just over 15kt", () => {
    expect(windSpeedColor(15.1 * KT_TO_MS)).toBe("#ef4444");
  });

  it("is red well over 15kt", () => {
    expect(windSpeedColor(30 * KT_TO_MS)).toBe("#ef4444");
  });

  it("is green at zero wind", () => {
    expect(windSpeedColor(0)).toBe("#22c55e");
  });
});
