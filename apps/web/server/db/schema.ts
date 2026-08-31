import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  doublePrecision,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const geographyPoint = customType<{ data: string }>({
  dataType() {
    return "geography(Point,4326)";
  },
});

// Known drizzle-kit quirk: for a GENERATED ALWAYS AS column using this
// customType, `drizzle-kit generate` wraps the type in double quotes
// ("geography(Point,4326)"), which Postgres parses as one quoted identifier
// rather than the type + modifier — CREATE TABLE then fails with
// `type "geography(Point,4326)" does not exist`. If schema.ts ever changes
// and a migration gets regenerated, check the new SQL file's `geog` column
// definition for this and strip the stray quotes by hand before applying.

/**
 * One saved rock-fishing ledge. facing_bearing is the compass direction the
 * ledge face points OUT TO SEA (0-359deg) — swell/current "coming from" this
 * bearing is what registers as full load in the LLI formulas.
 *
 * Measurement columns use double precision rather than numeric: none of
 * this data needs exact decimal arithmetic, and it keeps every value a
 * plain JS number end to end (installed drizzle-orm's numeric() type
 * doesn't support a number-mode column in this version).
 */
export const ledges = pgTable(
  "ledges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    area: text("area").notNull(),
    lat: doublePrecision("lat").notNull(),
    lon: doublePrecision("lon").notNull(),
    facingBearing: doublePrecision("facing_bearing").notNull(),
    platformHeightM: doublePrecision("platform_height_m").notNull(),
    // tan(beta), the foreshore/slope estimate used by the Stockdon runup
    // formula. Null falls back to DEFAULT_SLOPE_TANB (see model/constants.ts).
    slopeEstimate: doublePrecision("slope_estimate"),
    safetyMargin: doublePrecision("safety_margin").notNull().default(0.7),
    isDeclaredHazard: boolean("is_declared_hazard").notNull().default(false),
    // Estimated from general geography, not surveyed on-site. The frontend
    // must visibly flag any ledge where this is false — see UnverifiedBadge.
    heightVerified: boolean("height_verified").notNull().default(false),
    // True for a ledge inside a sheltered harbour, where ocean swell doesn't
    // reach — Fishing Pressure for these ledges is computed from tide alone
    // rather than the default swell+tide blend. See
    // server/model/fishingPressure.ts's sheltered branch.
    sheltered: boolean("sheltered").notNull().default(false),
    notes: text("notes"),
    // The coordinate the most recent successful ODB tide fetch actually
    // used — the ledge's own lat/lon in the common case, or the
    // offshore-nudged fallback point when the exact coordinate's tide grid
    // cell was land-masked (see fetchTideWithFallback in
    // computeAndUpsert.ts). Open-Meteo swell/current has no such fallback
    // (always queries the ledge's own coordinate), so this only tracks
    // tide's behavior. Null until the first successful tide fetch.
    weatherStationLat: doublePrecision("weather_station_lat"),
    weatherStationLon: doublePrecision("weather_station_lon"),
    geog: geographyPoint("geog").generatedAlwaysAs(
      sql`ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography`,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("ledges_geog_gix").using("gist", table.geog)],
);

export const dangerTiers = ["normal", "caution", "dangerous"] as const;
export type DangerTier = (typeof dangerTiers)[number];

export const fishingTiers = ["poor", "fair", "good", "great"] as const;
export type FishingTier = (typeof fishingTiers)[number];

/**
 * Hourly forecast row for one ledge. Raw inputs and every computed field are
 * nullable: three independent free upstream APIs (Open-Meteo swell+current,
 * ODB tide) partially fail sometimes, and a null is more honest than a
 * fabricated 0 — the frontend renders null LLI as grey "no data", never 0.
 */
export const ledgeConditions = pgTable(
  "ledge_conditions",
  {
    ledgeId: uuid("ledge_id")
      .notNull()
      .references(() => ledges.id, { onDelete: "cascade" }),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    sourceRunAt: timestamp("source_run_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Raw inputs
    hsM: doublePrecision("hs_m"),
    tpS: doublePrecision("tp_s"),
    swellDirDeg: doublePrecision("swell_dir_deg"),
    currentSpeedMs: doublePrecision("current_speed_ms"),
    currentDirDeg: doublePrecision("current_dir_deg"),
    tideHeightCm: doublePrecision("tide_height_cm"),
    tideRateCmPerHr: doublePrecision("tide_rate_cm_per_hr"),

    // Computed
    waveLoad: doublePrecision("wave_load"),
    currentLoad: doublePrecision("current_load"),
    tideModulationFactor: doublePrecision("tide_modulation_factor"),
    lli: doublePrecision("lli"),
    r2EstimateM: doublePrecision("r2_estimate_m"),
    dangerFlag: boolean("danger_flag"),
    dangerTier: text("danger_tier", { enum: dangerTiers }),

    // Fishing Pressure Index (independent of the LLI/danger safety model
    // above) — see server/model/fishingPressure.ts. tideCurrent* are the
    // ODB tidal current vector resolved to speed+bearing, kept alongside
    // the score since they're otherwise-derived-only values.
    tideCurrentSpeedMs: doublePrecision("tide_current_speed_ms"),
    tideCurrentDirDeg: doublePrecision("tide_current_dir_deg"),
    fishingPressure: doublePrecision("fishing_pressure"),
    fishingTier: text("fishing_tier", { enum: fishingTiers }),

    dataComplete: boolean("data_complete").generatedAlwaysAs(
      sql`(hs_m is not null and tp_s is not null and swell_dir_deg is not null and current_speed_ms is not null and current_dir_deg is not null and tide_height_cm is not null)`,
    ),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.ledgeId, table.ts] }),
    index("ledge_conditions_ts_idx").on(table.ts),
    index("ledge_conditions_danger_idx")
      .on(table.ts)
      .where(sql`danger_flag`),
  ],
);

export type Ledge = typeof ledges.$inferSelect;
export type NewLedge = typeof ledges.$inferInsert;
export type LedgeCondition = typeof ledgeConditions.$inferSelect;
export type NewLedgeCondition = typeof ledgeConditions.$inferInsert;
