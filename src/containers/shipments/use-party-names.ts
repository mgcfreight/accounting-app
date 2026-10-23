import { useQueries } from "@tanstack/react-query";
import { PartyView } from "@/lib/interfaces";
import { getParty } from "@/services";

// Shipments carry party ids only, so names are looked up one party at a
// time — each distinct id once, cached under the same key the party page
// uses. Returns the parties found so far by id; a missing entry is still
// loading or failed.
export default function usePartyNames(ids: (string | null | undefined)[]) {
  const unique = Array.from(new Set(ids.filter((id): id is string => !!id)));
  const results = useQueries({
    queries: unique.map((id) => ({
      queryKey: ["parties", "detail", id],
      queryFn: ({ signal }: { signal: AbortSignal }) => getParty(id, signal),
      staleTime: 5 * 60_000,
    })),
  });

  const parties = new Map<string, PartyView>();
  results.forEach((result) => {
    if (result.data) parties.set(result.data.id, result.data);
  });
  return parties;
}
