import { getCachedGames } from "@/lib/db/cachedQueries";
import { getCachedTrackedOpponents } from "@/lib/db/cachedQueries";
import { mergeOpponentNameLists, uniqueOpponentNames } from "@/lib/opponentUtils";
import { OpponentsPageClientGate } from "./OpponentsPageClientGate";

export const dynamic = "force-dynamic";

export default async function OpponentsPage() {
  const [games, tracked] = await Promise.all([getCachedGames(), getCachedTrackedOpponents()]);
  const names = mergeOpponentNameLists(
    uniqueOpponentNames(games),
    tracked.map((r) => r.name)
  );

  return (
    <div className="space-y-6">
      <OpponentsPageClientGate names={names} tracked={tracked} />
    </div>
  );
}
