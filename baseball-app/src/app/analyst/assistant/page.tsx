import { canMutateData } from "@/lib/demoMode";
import { fetchTeamTrendsPayload } from "@/app/reports/actions";
import { AssistantPageClientGate } from "./AssistantPageClientGate";

export default async function AnalystAssistantPage() {
  const canEdit = canMutateData();
  const trendsRes = await fetchTeamTrendsPayload(12);
  const teamTrends = "error" in trendsRes ? { insights: ["Could not load team trends."] } : trendsRes;

  return (
    <AssistantPageClientGate teamTrendInsights={teamTrends.insights} canEdit={canEdit} />
  );
}
