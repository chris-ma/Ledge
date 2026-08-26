# Calibration notes

Every constant in `apps/web/server/model/constants.ts` is a first-pass guess,
not a value calibrated against real outcomes. This doc records the reasoning
behind each one so a later tuning pass has something to work from instead of
guessing twice.

## LLI (Ledge Load Index)

| Constant | Value | Why |
|---|---|---|
| `WAVE_LOAD_REF_MAX` | 200 | `wave_load = Hs^2 * Tp * cos(theta)` for a "big swell day" (Hs 4m, Tp 12.5s) is `4^2 * 12.5 = 200`. Used as the saturation point for normalizing wave_load to 0-1. |
| `CURRENT_LOAD_REF_MAX` | 200 | `current_load = 0.5 * rho * v^2 * cos(phi)` reaches 200 at `v ~= 0.62 m/s` (rho=1025). A moderate-strong nearshore current, chosen as the saturation point for current_load's 0-1 normalization. |
| `WAVE_WEIGHT` / `CURRENT_WEIGHT` | 0.7 / 0.3 | The spec frames wave energy as the primary driver (Component 1, and the whole "gap this fills" motivation in section 1); current is a secondary/complementary push term. |
| `TIDE_TARGET_FRACTION` | 0.5 | The tide-modulation bell curve peaks at 50% of platform height above datum — an arbitrary but reasonable "mid-tide is often the productive band" starting assumption. |
| `TIDE_SIGMA_FRACTION` | 0.35 | Controls how wide the bell curve is (as a fraction of platform height). Wide enough that the curve doesn't zero out too aggressively at the tide extremes. |
| `TIDE_RATE_BOOST_K` | 0.25 | Max 25% boost to the LLI for a tide moving at the fastest rate this model tracks (30cm/hr) — a moving tide is assumed to concentrate bait/current activity, but shouldn't dominate the height term. |
| `TIDE_RATE_MAX_CM_PER_HR` | 30 | Roughly the fastest hourly tide rate-of-change seen on the NSW coast (mid-tide on a big spring tide) — used as the boost's saturation point. |

Normalization is **fixed reference-max**, not rolling min-max, so the map
view's cross-ledge comparison at one hour stays meaningful (self-relative
normalization would paint some red on every ledge even in a flat week).

## Danger tiers (Stockdon R2)

| Constant | Value | Why |
|---|---|---|
| `CAUTION_THRESHOLD_FRACTION` | 0.75 | Caution triggers at 75% of the dangerous threshold — gives a warning band before the platform is modelled as actually overtopped. |
| `TP_SHARP_RISE_S` | 2.0s | A peak-period rise of 2+ seconds within `TREND_WINDOW_HOURS` is treated as "rising sharply" — the spec's own trigger for the classic long-period-groundswell rogue-wave precursor. |
| `TREND_WINDOW_HOURS` | 3 | How far back the trend checks (sharp period rise, rising tide + rising period) look. |
| `DEFAULT_SLOPE_TANB` | 0.10 | Fallback foreshore slope for any ledge without a `slope_estimate` — a moderate rocky-shore gradient. |

Per-ledge `safety_margin` (default 0.70, lowered to 0.60 for the three
README-flagged known-hazard seed ledges) is the main dial for "how
conservative is this ledge's danger flag" — see `server/db/seed.ts`.

## Fishing Pressure Index

A separate score from LLI/danger above — "how much swell and tide are
pushing directly onto this ledge's face right now", as a fishing-opportunity
signal rather than a safety one. Reuses the LLI's swell term (`wave_load`)
unchanged; the tide term is new, built from ODB's modelled tidal current
vector (`u`/`v`, previously fetched but unused) rather than guessing which
compass bearing "rising tide" favours — the current's own direction and
speed each hour already encode flood vs. ebb correctly for that ledge's
location.

| Constant | Value | Why |
|---|---|---|
| `TIDE_CURRENT_PRESSURE_REF_MAX_MS` | 0.03 m/s | Corrected from an initial guess of 0.3 (30 cm/s) after seeing real ODB/TPXO output for the seeded ledges: observed tidal current speeds ran ~0.005-0.023 m/s, an order of magnitude smaller than assumed, which had been crushing the tide term to near-zero (every ledge reading "poor") regardless of actual conditions. Still a first-pass guess — a full spring/neap cycle hasn't been observed, just one snapshot. |
| `FISHING_SWELL_WEIGHT` / `FISHING_TIDE_WEIGHT` | 0.5 / 0.5 | Equal weight, unlike LLI's safety-driven 0.7/0.3 split — the feature request that motivated this named swell and tide as two equally contributing halves of "pressure". |
| `FISHING_FAIR_THRESHOLD` / `FISHING_GOOD_THRESHOLD` / `FISHING_GREAT_THRESHOLD` | 25 / 50 / 75 | Even 4-way split of the 0-100 score into poor/fair/good/great — no basis yet for uneven bands. |

`tide_current_dir_deg` is stored using the same "source bearing" convention
as `swell_dir_deg` (the direction the flow is arriving *from*), even though
ODB's raw `u`/`v` describe the direction water moves *toward* — see the
conversion and reasoning in `server/model/fishingPressure.ts`.

## What "calibrating" would actually mean

None of the above has been checked against real fishing outcomes or incident
history. A real calibration pass would:

1. Log actual LLI/danger values against known good/bad fishing sessions and
   any near-miss/incident reports at the seeded ledges (several are declared
   NSW hazard locations with public incident history — see README section
   4a) and adjust the weights/reference-maxes to match.
2. Compare `computeStockdonR2` output against Manly Hydraulics Laboratory's
   real-time wave/tide gauge data for the Sydney ledges within their
   network, since that's real observed data rather than the Open-Meteo/ODB
   forecast this MVP runs on.
3. Consider per-ledge overrides for constants that are currently global
   (e.g. `TIDE_TARGET_FRACTION` probably isn't the same for every ledge
   shape) once there's a specific reason to believe one ledge behaves
   differently.

None of that is in scope for the MVP — the goal here was a first working
version with every assumption named and swappable, not a validated model.
