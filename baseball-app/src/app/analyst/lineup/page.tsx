import { LineupConstructionClientGate } from "./LineupConstructionClientGate";
import { loadLineupConstructionPageProps } from "./loadLineupConstructionPageProps";

export const dynamic = "force-dynamic";

export default async function LineupConstructionPage() {
  const props = await loadLineupConstructionPageProps();
  return <LineupConstructionClientGate {...props} />;
}
