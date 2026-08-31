// Hand-written to match the wire format of the backend's JSON responses
// exactly (ISO date *strings*, not Date objects — see apps/web CLAUDE
// instructions for why this isn't imported from the Drizzle schema).

export interface Ledge {
  id: string;
  name: string;
  area: string;
  lat: number;
  lon: number;
  /** 0-359, compass bearing the ledge face points OUT TO SEA. */
  facingBearing: number;
  platformHeightM: number;
  slopeEstimate: number | null;
  safetyMargin: number;
  isDeclaredHazard: boolean;
  /** false = estimated location/height, NOT surveyed — must be visibly flagged in the UI. */
  heightVerified: boolean;
  /** True for a ledge inside a sheltered harbour — its Fishing Condition score is tide-only, not swell+tide. */
  sheltered: boolean;
  notes: string | null;
  /** The coordinate the most recent successful tide fetch actually used — null until the first success. */
  weatherStationLat: number | null;
  weatherStationLon: number | null;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export type DangerTier = "normal" | "caution" | "dangerous";
export type FishingTier = "poor" | "fair" | "good" | "great";

export interface LedgeCondition {
  ledgeId: string;
  ts: string; // ISO 8601, UTC, top of hour
  hsM: number | null;
  tpS: number | null;
  swellDirDeg: number | null;
  currentSpeedMs: number | null;
  currentDirDeg: number | null;
  tideHeightCm: number | null;
  tideRateCmPerHr: number | null;
  waveLoad: number | null;
  currentLoad: number | null;
  tideModulationFactor: number | null;
  /** 0-100, or null meaning "no data for this hour" (upstream API gap) — NEVER treat null as 0. */
  lli: number | null;
  r2EstimateM: number | null;
  dangerFlag: boolean | null;
  dangerTier: DangerTier | null;
  /** Tidal current (ODB/TPXO), independent of the danger safety model. */
  tideCurrentSpeedMs: number | null;
  tideCurrentDirDeg: number | null;
  /** 0-100 Fishing Pressure Index, or null meaning "no data for this hour" — NEVER treat null as 0. */
  fishingPressure: number | null;
  fishingTier: FishingTier | null;
  dataComplete: boolean;
  createdAt: string;
}

export interface LedgesResponse {
  ledges: Ledge[];
}

export interface LedgeConditionsResponse {
  conditions: LedgeCondition[];
}
