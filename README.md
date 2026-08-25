# Ledge Lords — Product Spec

**Core idea:** a per-spot heat map showing how much tide/swell/current *pressure* is loading a specific ledge, right now and over the next 7–14 days — not generic tide/swell numbers, but a directional, structure-aware intensity score. Plus a built-in danger flag when conditions cross into rock-fishing hazard territory.

**Data domain:** Australia-wide (BOM tide, Open-Meteo Marine swell, and eventual current data all cover the whole AU coastline). **MVP testing footprint is concentrated around Sydney** — see [Section 4a](#4a-mvp-launch-geography--sydney) — so the model, thresholds, and UI can be validated against a dense, geographically varied cluster of real ledges before opening the `ledges` table up nationally.

---

## 1. The gap this fills

Existing apps (Fish & Tides, BiteCompass, FishingPoints, Surfline/Wavemaps) all compute tide, swell, and a 0–100 "bite score," but they're either:
- Coast-wide / spot-generic (swell height at a beach, not at *your* ledge), or
- Non-directional (they don't know which way your ledge faces, so they can't tell you if the swell/current is actually hitting it)

Wave energy flux is a known concept in coastal engineering and surf forecasting — power is a function of significant wave height and period (P ∝ Hs² × Tp), and near-coast refraction typically increases the energy directed normal to a stretch of coast to roughly 65–75% of the unit-circle value. Nobody applies this to a single saved fishing mark with a stored facing bearing.

---

## 2. Core metric: Ledge Load Index (LLI)

Computed hourly, per saved ledge, 0–100.

**Inputs per ledge (set once, when you drop the pin):**
- `lat`, `lon`
- `facing_bearing` — the compass direction the ledge face points into (degrees)
- `platform_height_m` — height of the fishing platform above chart datum (for the danger score)
- optional: local beach/reef slope estimate, if known

**Component 1 — Wave load**
```
wave_load = Hs² × Tp × cos(θ)
```
where θ = angle between incoming swell direction and `facing_bearing`. A ledge facing square into the swell gets full load; one 80°+ off gets almost none.

**Component 2 — Current load**
```
current_load = 0.5 × ρ × v² × cos(φ)
```
where v = current speed, φ = angle between current direction and `facing_bearing`. This is the literal "current pushing bait onto the ledge" term.

**Component 3 — Tide modulation**
Tide height and rate-of-change scale how much of that energy reaches the productive depth band on the structure. A ledge in 2 m at low tide behaves differently to the same ledge in 6 m at high.

**Composite:**
```
LLI = normalize(wave_load, current_load) × tide_modulation_factor
```
Store hourly for the forecast window per ledge.

---

## 3. Danger warning system

Rock/ledge fishing risk in Australia is strongly tied to swell height, period, and tide state — rising tides and higher swell periods are what trap or wash anglers off platforms. This needs its own score, separate from the "is it good for fishing" score, because high LLI and high danger often overlap (the same energy that pushes bait onto a ledge can wash you off it).

**Approach — wave runup estimate:**
Use the Stockdon et al. (2006) empirical runup formula, R2 (the 2%-exceedance runup elevation), which parameterizes extreme runup from offshore significant wave height, peak period, and beach/foreshore slope. It was developed and validated on natural (mostly sandy) beaches, so treat it as a *heuristic proxy* for rock platforms, not a certified safety figure — calibrate `platform_height_m` and slope per spot against your own observations before trusting it.

```
danger_flag = TRUE if R2_estimate(Hs, Tp, slope) > platform_height_m × safety_margin
```

Suggested tiers for the UI:
- 🟢 **Normal** — modelled runup well below platform height
- 🟡 **Caution** — runup approaching platform height, or rising tide + increasing period
- 🔴 **Dangerous** — modelled runup at or above platform height, or swell period rising sharply (long-period groundswell is the classic "rogue wave" precursor on ledges)

**Do not treat this as a substitute for:**
- BOM Hazardous Surf Warnings
- State-based rock fishing safety guidance (life jacket requirements, no-fishing declarations on specific platforms)
- Your own on-the-water judgement

This should ship as a supplementary flag, worded as such in the UI, not a green light.

---

## 4. Heat map rendering

- **Single ledge, time view:** day (rows) × hour (columns) grid, colour = LLI intensity — same visual language as a GitHub contribution graph. Overlay a red border/hatch on cells where `danger_flag` is true, independent of the LLI colour underneath — you want to see "great load, but dangerous" as a distinct visual state, not just a high score.
- **Multiple ledges, map view:** marker colour/intensity per ledge for the selected hour, with the same danger overlay (red ring) on markers that are flagged.

### 4a. MVP launch geography — Sydney

The data model and every source in Section 5 are national (BOM and Open-Meteo cover the whole AU coast), so nothing here restricts where a ledge *can* be added. For the MVP, seed the `ledges` table with a deliberately compact, deliberately varied cluster of Sydney metro spots — roughly Royal National Park in the south to Palm Beach in the north — instead of spreading thin across the whole coastline. Two things make Sydney a good first cluster:

1. **Facing-bearing diversity in a small radius.** The coastline bends enough between Cronulla and Palm Beach that you get ledges facing E, SE, and NE within a ~50 km stretch — enough to actually exercise the `cos(θ)` directional term instead of testing on a run of near-identical headlands.
2. **A ground-truth check for the danger model.** NSW has a number of officially recognised/declared dangerous rock-fishing locations (subject to mandatory PFD rules under NSW DPI regulations) clustered in this exact stretch — these give the `danger_flag` model real incident history to sanity-check against, not just the Stockdon heuristic in a vacuum. Treat "declared dangerous" status as an input to validate the model, not as something the model should be relied on to replace.

**Suggested seed list** (candidates for the initial `ledges` rows — verify exact coordinates and platform heights on-site before relying on them; several of these are known hazard locations and should launch with conservative `safety_margin` defaults):

| Ledge | Area | Approx. facing | Notes |
|---|---|---|---|
| Cape Solander | Kurnell / Royal NP | SE–E | Open ocean, historically one of NSW's highest-risk rock fishing spots — good stress test for the danger model |
| Jibbon Point | Bundeena | E–SE | Royal NP, moderate exposure |
| Voodoo Point | Malabar | SE | |
| Wedding Cake Island headland | Coogee | E | |
| Ben Buckler | Bondi | NE | |
| Diamond Bay | Vaucluse | E | |
| The Gap | Watsons Bay | E | Iconic and heavily fished; also a known hazard location |
| North Head | Manly | E–NE | |
| Fairy Bower | Manly | N–NE | More sheltered — useful low-load control case |
| Long Reef Point | Collaroy | E | Known hazard location |
| Dee Why Point | Dee Why | E | |
| Barrenjoey Head | Palm Beach | N–NE (ocean side) | Ocean side vs. Pittwater side gives two facing bearings on one headland — useful edge case for the model |

This list is a starting point for seeding and testing, not a safety endorsement of any location — always confirm current NSW rock-fishing safety declarations and BOM warnings directly before fishing any of these.

---

## 5. Data sources

| Input | Source | Status |
|---|---|---|
| Swell (Hs, Tp, direction) | Open-Meteo Marine API | Free, straightforward, national coverage |
| Tide (height, times) | BOM tide data | Already used in Bite Window, national coverage |
| Current (speed, direction) | **Gap** — BOM has no simple current API; likely need CSIRO/BOM eReefs model output, or treat as estimated/derived until a clean feed is found | Needs 30 min of research before committing — check eReefs model resolution/coverage specifically for the Sydney metro shelf, since that's the MVP test area |
| Bathymetry / slope near ledge | AHO / AusSeabed, or a manually-entered slope estimate per ledge | Optional for MVP — start with a manual slope field |

---

## 6. Architecture (MVP)

Same stack as Photo Scout / Bite Window:
- **Supabase + PostGIS** — `ledges` table (id, name, lat, lon, facing_bearing, platform_height_m, slope_estimate). Seed this table with the Sydney candidate list in Section 4a for MVP testing.
- **Scheduled Edge Function** — pulls swell/tide/current forecast per ledge daily, computes LLI + danger_flag hourly, writes to a time-series table
- **React front end** — heat map grid component (per ledge) + map view (all ledges), colour scale + danger overlay. Default map view centred on Sydney for MVP.

---

## 7. Open questions before build

1. Current data feed for AU nearshore — resolve this first, it's the component with no free clean source. Prioritise checking eReefs coverage/resolution for the Sydney shelf specifically, since that's where the MVP needs it to actually work.
2. Whether to calibrate the Stockdon runup model per-region using historical AU rock fishing incident data, or ship with a conservative default margin — Sydney's declared dangerous locations (Section 4a) are a natural first calibration set.
3. Whether danger tier thresholds should be user-adjustable (a more experienced/rock-hopping angler vs. a cautious one) or fixed.
4. Exact seed list and coordinates for the Sydney MVP cluster — the Section 4a table is a starting point; confirm platform heights and facing bearings on-site (or via aerial/streetview survey) before they drive a live danger flag.
