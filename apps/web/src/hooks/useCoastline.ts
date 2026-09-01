import { useQuery } from "@tanstack/react-query";
import { fetchCoastline } from "@/lib/api";

/**
 * GET /api/coastline — the real coastline runs the map paints Fishing
 * Condition onto. Static geometry that only changes when the coastline is
 * rebuilt, so it never needs refetching within a session.
 */
export function useCoastline() {
  return useQuery({
    queryKey: ["coastline"],
    queryFn: fetchCoastline,
    staleTime: Infinity,
    refetchInterval: false,
  });
}
