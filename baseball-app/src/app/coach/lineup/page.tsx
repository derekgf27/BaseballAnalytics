import { LineupConstructionClientGate } from "@/app/analyst/lineup/LineupConstructionClientGate";
import { loadLineupConstructionPageProps } from "@/app/analyst/lineup/loadLineupConstructionPageProps";

export const dynamic = "force-dynamic";

/**
 * Coach lineup: same builder as Analyst → Lineup (per-game save).
 */
export default async function CoachLineupPage() {
  const props = await loadLineupConstructionPageProps();
  return <LineupConstructionClientGate {...props} />;
}
