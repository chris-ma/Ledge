/** For ledges where `heightVerified === false`: location/height/slope are estimates, not surveyed on-site. */
export function UnverifiedBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-slate-400 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
      title="This ledge's location, platform height and slope are estimated, not surveyed on-site."
    >
      ⚠ Unverified location/height
    </span>
  );
}
