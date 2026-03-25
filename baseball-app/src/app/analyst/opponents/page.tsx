import { getGames, getTrackedOpponents } from "@/lib/db/queries";
import { mergeOpponentNameLists, uniqueOpponentNames } from "@/lib/opponentUtils";
import { OpponentsPageClient } from "./OpponentsPageClient";

export const dynamic = "force-dynamic";

export default async function OpponentsPage() {
  const [games, tracked] = await Promise.all([getGames(), getTrackedOpponents()]);
  const names = mergeOpponentNameLists(
    uniqueOpponentNames(games),
    tracked.map((r) => r.name)
  );

  return (
    <div className="space-y-6">
      <OpponentsPageClient names={names} tracked={tracked} />
    </div>
  );
}
