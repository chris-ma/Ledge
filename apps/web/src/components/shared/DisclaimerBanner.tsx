/**
 * Persistent disclaimer (not buried in an About page) — shown on every page
 * that surfaces the danger flag. Keep the wording explicit about what the
 * flag is and isn't: a Stockdon et al. (2006) sandy-beach runup heuristic
 * used as a rock-platform proxy, not a certified safety figure, and not a
 * substitute for official warnings or the angler's own judgement.
 */
export function DisclaimerBanner() {
  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900 sm:text-sm">
      <p>
        <strong>Not a safety certification.</strong> The danger flag here is estimated from the
        Stockdon et al. (2006) wave-runup formula — a heuristic developed and validated for sandy
        beaches, applied here only as an approximate proxy for rock platforms. It is{" "}
        <strong>not</strong> a certified safety figure, and it does not replace the Bureau of
        Meteorology&rsquo;s Hazardous Surf Warnings, NSW Government declared rock-fishing safety
        zones, or your own on-the-water judgement. Conditions change fast — this app can be wrong.
      </p>
    </div>
  );
}
