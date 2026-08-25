# Deploying Ledge Lords

One-time setup, in order. Run all commands from `apps/web/`.

## 1. Connect Neon

In the Vercel dashboard, open the `ledge-lords` project (already linked to
this repo) → **Storage** tab → **Connect Database** → **Neon** → free plan,
`ap-southeast-2` (Sydney) region if offered. This auto-injects
`DATABASE_URL` (and a couple of Neon-specific variants) into the project's
environment variables for all environments.

Pull it locally:

```sh
vercel env pull .env
```

## 2. Apply the schema and seed data

```sh
npm run db:migrate   # creates the postgis extension, then applies drizzle/*.sql
npm run db:seed      # upserts the 12 Sydney MVP ledges (server/db/seed.ts)
```

`db:migrate` is a small script (`server/db/migrate.ts`), not the raw
`drizzle-kit migrate` CLI — it enables the `postgis` extension first, since
the `ledges.geog` generated column needs `geography(Point,4326)` to exist
before that table is created.

## 3. Set CRON_SECRET

Any random string, set as a Vercel project env var (Production + Preview):

```sh
vercel env add CRON_SECRET production
vercel env add CRON_SECRET preview
```

Vercel Cron sends this automatically as `Authorization: Bearer $CRON_SECRET`
when calling `/api/cron/refresh` — see `vercel.json` for the schedule
(`0 16 * * *` UTC, once daily, Hobby-plan-compatible).

## 4. Deploy

Push to the tracked branch, or `vercel --prod`. Then smoke-test the refresh
job once by hand before relying on the schedule:

```sh
curl -H "Authorization: Bearer $CRON_SECRET" https://<deployment-url>/api/cron/refresh
```

Expect a JSON summary: `{ ledgesProcessed, ledgesFailed, rowsUpserted, results }`.
`ledgesFailed > 0` isn't necessarily fatal — check `results[].error` for
which ledge and why (see the "known verification gap" note below before
assuming it's a bug).

## Known verification gap

This build's sandbox was policy-blocked from reaching both
`marine-api.open-meteo.com` and `eco.odb.ntu.edu.tw`, so
`server/sources/openMeteo.ts` and `server/sources/odbTide.ts` were written
against documented parameters, not a live response. The most likely first
failure points, in order of likelihood:

1. **`ocean_current_direction`'s convention** ("from" vs "to") —
   `openMeteo.ts` has this as a single named, commented constant
   (`OCEAN_CURRENT_DIRECTION_CONVENTION`) specifically so it's a one-line
   flip once real data shows whether `current_load`'s directional term looks
   right (the East Australian Current runs south along the NSW coast, so it
   should register as loading south/southeast-facing ledges).
2. **ODB's actual JSON response shape** — `parseOdbTideResponse` handles the
   two most likely shapes and throws with a snippet of the raw body if
   neither matches, so a mismatch shows up clearly in the function's logs
   (Vercel dashboard → the deployment → Functions → `/api/cron/refresh`)
   rather than silently writing wrong data.
3. **Open-Meteo Marine's max `forecast_days`** — if it's lower than
   `FORECAST_DAYS` (10, in `constants.ts`), Open-Meteo most likely just
   returns fewer days rather than erroring; not fatal, just a shorter
   forecast window than intended until adjusted.

After the first real cron run, check `results` in the JSON summary and spot
one or two rows in `ledge_conditions` for a ledge you can sanity-check by
eye (e.g. Cape Solander's `wave_load` should be high on an actual big-swell
day).
