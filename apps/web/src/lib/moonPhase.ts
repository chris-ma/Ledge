// Pure astronomical calculation from a known reference new moon and the
// synodic month length — accurate to within about a day, which is all a
// supplementary "what's the moon doing" display needs. No API/network call.

const SYNODIC_MONTH_DAYS = 29.53058867;
// 2000-01-06 18:14 UTC — a well-known reference new moon.
const REFERENCE_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface MoonPhase {
  /** 0 (new) .. 1 (next new), fraction of the way through the current cycle. */
  phase: number;
  /** 0 (new, dark) .. 1 (full, fully lit) illuminated fraction. */
  illumination: number;
  emoji: string;
}

const PHASE_EMOJI: readonly string[] = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];

/** Moon phase, illuminated fraction, and phase emoji for a given instant. */
export function getMoonPhase(date: Date): MoonPhase {
  const daysSinceReference = (date.getTime() - REFERENCE_NEW_MOON_MS) / ONE_DAY_MS;
  const phase =
    (((daysSinceReference % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS) / SYNODIC_MONTH_DAYS;
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  const emoji = PHASE_EMOJI[Math.floor(phase * 8) % 8];
  return { phase, illumination, emoji };
}
