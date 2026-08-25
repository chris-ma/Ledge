import { useQuery } from "@tanstack/react-query";
import { fetchLedges } from "@/lib/api";

/** GET /api/ledges */
export function useLedges() {
  return useQuery({
    queryKey: ["ledges"],
    queryFn: fetchLedges,
    staleTime: 5 * 60 * 1000,
  });
}
