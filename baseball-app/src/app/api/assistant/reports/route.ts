import { NextResponse } from "next/server";
import { answerReportsAssistant, type ReportsAssistantContext } from "@/lib/assistant/reportsAssistant";

type RequestBody = {
  query?: string;
  context?: ReportsAssistantContext;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const query = body.query?.trim() ?? "";
    if (!query) return NextResponse.json({ error: "Query is required." }, { status: 400 });

    const context: ReportsAssistantContext = body.context ?? {
      game: null,
      preGameOverview: null,
      teamTrendInsights: [],
    };

    const result = await answerReportsAssistant(query, context);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Could not process assistant request." }, { status: 500 });
  }
}
