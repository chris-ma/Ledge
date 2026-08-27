import { describe, expect, it } from "vitest";
import { filterUpcomingWindows, summarizeTierWindows } from "./windows";

type Tier = "normal" | "caution" | "dangerous";
const NOTABLE = new Set<Tier>(["caution", "dangerous"]);

function hour(n: number): string {
  return new Date(Date.UTC(2026, 0, 1, n)).toISOString();
}

function condition(n: number, tier: Tier | null) {
  return { ts: hour(n), tier };
}

const getTier = (c: { tier: Tier | null }) => c.tier;

describe("summarizeTierWindows", () => {
  it("returns nothing for an empty series", () => {
    expect(summarizeTierWindows([], getTier, NOTABLE)).toEqual([]);
  });

  it("returns nothing when no hour is notable", () => {
    const series = [condition(0, "normal"), condition(1, "normal")];
    expect(summarizeTierWindows(series, getTier, NOTABLE)).toEqual([]);
  });

  it("merges a contiguous run of the same notable tier into one window", () => {
    const series = [
      condition(0, "normal"),
      condition(1, "caution"),
      condition(2, "caution"),
      condition(3, "caution"),
      condition(4, "normal"),
    ];
    expect(summarizeTierWindows(series, getTier, NOTABLE)).toEqual([
      { startTs: hour(1), endTs: hour(3), tier: "caution" },
    ]);
  });

  it("does not bridge a data gap (missing hour) into one window", () => {
    // hour 2 is simply absent, not present-with-a-normal-tier
    const series = [condition(1, "caution"), condition(3, "caution")];
    expect(summarizeTierWindows(series, getTier, NOTABLE)).toEqual([
      { startTs: hour(1), endTs: hour(1), tier: "caution" },
      { startTs: hour(3), endTs: hour(3), tier: "caution" },
    ]);
  });

  it("splits a window on a tier change even with no gap", () => {
    const series = [condition(1, "caution"), condition(2, "dangerous"), condition(3, "dangerous")];
    expect(summarizeTierWindows(series, getTier, NOTABLE)).toEqual([
      { startTs: hour(1), endTs: hour(1), tier: "caution" },
      { startTs: hour(2), endTs: hour(3), tier: "dangerous" },
    ]);
  });

  it("treats every hour as notable when the whole series matches", () => {
    const series = [condition(0, "dangerous"), condition(1, "dangerous")];
    expect(summarizeTierWindows(series, getTier, NOTABLE)).toEqual([
      { startTs: hour(0), endTs: hour(1), tier: "dangerous" },
    ]);
  });

  it("sorts out-of-order input before merging", () => {
    const series = [condition(2, "caution"), condition(1, "caution")];
    expect(summarizeTierWindows(series, getTier, NOTABLE)).toEqual([
      { startTs: hour(1), endTs: hour(2), tier: "caution" },
    ]);
  });

  it("treats a null tier as not notable", () => {
    const series = [condition(0, null), condition(1, "caution")];
    expect(summarizeTierWindows(series, getTier, NOTABLE)).toEqual([
      { startTs: hour(1), endTs: hour(1), tier: "caution" },
    ]);
  });
});

describe("filterUpcomingWindows", () => {
  const windows = [
    { startTs: hour(1), endTs: hour(2), tier: "caution" as const },
    { startTs: hour(5), endTs: hour(6), tier: "dangerous" as const },
  ];

  it("drops a window that fully ended before now", () => {
    // window 1 ends at hour(2), covering until hour(3) — now at hour(4) is past that
    expect(filterUpcomingWindows(windows, hour(4))).toEqual([windows[1]]);
  });

  it("keeps a window that's still in progress (started in the past, hasn't ended)", () => {
    // now at hour(2): window 1's coverage extends to hour(3), so it's still ongoing
    expect(filterUpcomingWindows(windows, hour(2))).toEqual(windows);
  });

  it("keeps everything when now is before all windows", () => {
    expect(filterUpcomingWindows(windows, hour(0))).toEqual(windows);
  });
});
