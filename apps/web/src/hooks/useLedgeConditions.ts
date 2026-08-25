import { useQuery } from "@tanstack/react-query";
import { fetchLedgeConditions } from "@/lib/api";

/**
 * GET /api/ledge-conditions?ledgeId=&from=&to= — one ledge's hourly series,
 * for the per-ledge heat map grid.
 */
export function useLedgeConditions(ledgeId: string, fromIso: string, toIso: string) {
  return useQuery({
    queryKey: ["ledge-conditions", ledgeId, fromIso, toIso],
    queryFn: () => fetchLedgeConditions({ ledgeId, fromIso, toIso }),
    enabled: Boolean(ledgeId) && Boolean(fromIso) && Boolean(toIso),
  });
}
