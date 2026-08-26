// Every constant here is a named, first-pass heuristic guess, not a
// calibrated value — see docs/CALIBRATION.md for the rationale behind each
// one and how to tune it once real outcomes are available to check against.

export const SEAWATER_DENSITY_KG_M3 = 1025;
export const GRAVITY_M_S2 = 9.81;

/** tan(beta) fallback for ledges with no slope_estimate set. */
export const DEFAULT_SLOPE_TANB = 0.1;

/** How many days ahead the daily refresh fetches (spec asks for 7-14). */
export const FORECAST_DAYS = 10;

// LLI normalization: fixed reference-max scaling (not rolling min-max), so
// the map view's cross-ledge comparison at one hour stays meaningful — a
// self-relative normalization would paint some red on every ledge even in a
// flat week.
/** wave_load ("a big swell day") ~= Hs 4m, Tp 12.5s -> 4^2*12.5 = 200. */
export const WAVE_LOAD_REF_MAX = 200;
/** current_load at ~0.62 m/s: 0.5*1025*0.62^2 ~= 200. */
export const CURRENT_LOAD_REF_MAX = 200;
/** Wave energy is the spec's primary driver (Component 1, section 1's "gap
 * this fills"); current is a secondary/complementary push term. */
export const WAVE_WEIGHT = 0.7;
export const CURRENT_WEIGHT = 0.3;

// Tide modulation: a bell curve peaking at a platform-relative "sweet spot"
// tide height, not a monotonic ramp — encodes the spec's own example ("2m at
// low tide behaves differently to 6m at high": a ledge can be too covered as
// well as too exposed).
export const TIDE_TARGET_FRACTION = 0.5;
export const TIDE_SIGMA_FRACTION = 0.35;
export const TIDE_RATE_BOOST_K = 0.25;
export const TIDE_RATE_MAX_CM_PER_HR = 30;

// Danger tiers
export const CAUTION_THRESHOLD_FRACTION = 0.75;
/** Trailing-window peak-period rise (seconds) treated as "rising sharply". */
export const TP_SHARP_RISE_S = 2.0;
export const TREND_WINDOW_HOURS = 3;

// Fishing Pressure Index: "swell and tide pushing directly onto the ledge
// face" as a fishing-opportunity signal, independent of the LLI/danger
// model above (a ledge can be a great, safe fish right now). Reuses
// wave_load's existing directional cosine-clamp for the swell term; the
// tide term is new — ODB's tidal current vector (u/v), previously fetched
// but unused, gives a real modelled flood/ebb direction+speed per hour
// rather than us guessing "rising tide favours which compass bearing".
/** Swell term uses the same wave_load scale as the LLI model. */
export const FISHING_WAVE_LOAD_REF_MAX = WAVE_LOAD_REF_MAX;
/** A brisk tidal current for the open Sydney coast — saturation point for
 * the tide term's 0-1 normalization. Corrected from an initial guess of 0.3
 * (30 cm/s) after seeing real ODB/TPXO output for these ledges: observed
 * speeds ran ~0.005-0.023 m/s, an order of magnitude smaller, which had
 * been crushing the tide term to near-zero for every ledge/hour. */
export const TIDE_CURRENT_PRESSURE_REF_MAX_MS = 0.03;
/** Equal weight: the user's own framing named swell and tide as two equally
 * contributing halves of "pressure", unlike LLI's safety-driven 0.7/0.3 split. */
export const FISHING_SWELL_WEIGHT = 0.5;
export const FISHING_TIDE_WEIGHT = 0.5;
/** Even 4-way split of the 0-100 score into poor/fair/good/great. */
export const FISHING_FAIR_THRESHOLD = 25;
export const FISHING_GOOD_THRESHOLD = 50;
export const FISHING_GREAT_THRESHOLD = 75;
