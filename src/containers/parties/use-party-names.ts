import { useQueries } from "@tanstack/react-query";
import { useCan } from "@/components/providers/user-provider";
import { Permission } from "@/lib/enums";
import { PartyView } from "@/lib/interfaces";
import { getParty } from "@/services";

// Shipments and carrier invoices carry party ids only, so names are looked
// up one party at a time — each distinct id once, cached under the same key
// the party page uses. Returns the parties found so far by id; a missing
// entry is still loading, failed, or can't be read by this user (no
// parties.view), and the screen shows the id instead.
export default function usePartyNames(ids: (string | null | undefined)[]) {
  const { can } = useCan();
  const canRead = can(Permission.PartiesView);
  const unique = Array.from(new Set(ids.filter((id): id is string => !!id)));
  const results = useQueries({
    queries: unique.map((id) => ({
      queryKey: ["parties", "detail", id],
      queryFn: ({ signal }: { signal: AbortSignal }) => getParty(id, signal),
      staleTime: 5 * 60_000,
      enabled: canRead,
    })),
  });

  const parties = new Map<string, PartyView>();
  results.forEach((result) => {
    if (result.data) parties.set(result.data.id, result.data);
  });
  return parties;
}
