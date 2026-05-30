import { hasSupabase } from "@/lib/db/client";
import { fetchTeamTrendsPayload } from "@/app/reports/actions";
import { AssistantPageClientGate } from "./AssistantPageClientGate";

export default async function AnalystAssistantPage() {
  const canEdit = hasSupabase();
  const trendsRes = await fetchTeamTrendsPayload(12);
  const teamTrends = "error" in trendsRes ? { insights: ["Could not load team trends."] } : trendsRes;

  return (
    <AssistantPageClientGate teamTrendInsights={teamTrends.insights} canEdit={canEdit} />
  );
}
