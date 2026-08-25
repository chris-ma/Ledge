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
