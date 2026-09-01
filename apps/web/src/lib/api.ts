// Thin fetch wrappers against the /api/* contract. Plain fetch + relative
// URLs — same-origin on Vercel, no base URL config, no client env vars.

import type {
  CoastlineResponse,
  CoastlineSegment,
  Ledge,
  LedgeCondition,
  LedgeConditionsResponse,
  LedgesResponse,
} from "./types";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request to ${url} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function fetchLedges(): Promise<Ledge[]> {
  const data = await fetchJson<LedgesResponse>("/api/ledges");
  return data.ledges;
}

export async function fetchCoastline(): Promise<CoastlineSegment[]> {
  const data = await fetchJson<CoastlineResponse>("/api/coastline");
  return data.segments;
}

export interface FetchLedgeConditionsParams {
  fromIso: string;
  toIso: string;
  /** Omit for all ledges in range (map view); pass for one ledge's series (detail view). */
  ledgeId?: string;
}

export async function fetchLedgeConditions({
  fromIso,
  toIso,
  ledgeId,
}: FetchLedgeConditionsParams): Promise<LedgeCondition[]> {
  const params = new URLSearchParams({ from: fromIso, to: toIso });
  if (ledgeId) params.set("ledgeId", ledgeId);
  const data = await fetchJson<LedgeConditionsResponse>(`/api/ledge-conditions?${params.toString()}`);
  return data.conditions;
}
