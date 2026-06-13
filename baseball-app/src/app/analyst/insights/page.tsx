import { fetchInsightsDashboard } from "@/lib/insights";
import { InsightsPageClient } from "./InsightsPageClient";

export default async function InsightsPage() {
  const dashboard = await fetchInsightsDashboard();
  return <InsightsPageClient dashboard={dashboard} />;
}
