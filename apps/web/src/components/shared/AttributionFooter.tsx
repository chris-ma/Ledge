/** Credits the free public data providers this app builds on. */
export function AttributionFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-center text-[11px] leading-relaxed text-slate-500 sm:text-xs">
      Swell &amp; current data: <span className="font-medium">Open-Meteo</span>. Tide data:{" "}
      <span className="font-medium">Ocean Data Bank / TPXO</span>. Danger estimate adapted from
      Stockdon et al. (2006) wave runup.
    </footer>
  );
}
