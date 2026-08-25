import { useQuery } from "@tanstack/react-query";
import { fetchLedgeConditions } from "@/lib/api";

/**
 * GET /api/ledge-conditions?from=&to= (no ledgeId) — every ledge's series
 * across the whole window, fetched once. The map view's hour slider then
 * indexes into this client-side rather than refetching per slider tick.
 */
export function useConditionsAtRange(fromIso: string, toIso: string) {
  return useQuery({
    queryKey: ["conditions-at-range", fromIso, toIso],
    queryFn: () => fetchLedgeConditions({ fromIso, toIso }),
    enabled: Boolean(fromIso) && Boolean(toIso),
  });
}
