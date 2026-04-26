import type { PreGameOverviewPayload } from "@/app/reports/actions";
import { matchupLabelUsFirst } from "@/lib/opponentUtils";
import type { Game } from "@/lib/types";

export type ReportsAssistantContext = {
  game: Pick<Game, "id" | "date" | "home_team" | "away_team" | "our_side"> | null;
  preGameOverview: Pick<PreGameOverviewPayload, "report" | "recentGamesCount"> | null;
  teamTrendInsights: string[];
};

export type ReportsAssistantResponse = {
  answer: string;
  source: "rules" | "llm";
};

function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

function buildRulesAnswer(queryRaw: string, ctx: ReportsAssistantContext): string | null {
  const q = queryRaw.toLowerCase();
  const rep = ctx.preGameOverview?.report;
  if (!rep) return "Pick a game first so I can use your loaded pre-game report context.";

  if (q.includes("pregame") || q.includes("pre-game") || q.includes("full report") || q.includes("summary")) {
    const chunks: string[] = [];
    chunks.push("Pre-game report snapshot:");
    if (rep.gameContext.bullets.length) chunks.push(`- Context: ${rep.gameContext.bullets[0]}`);
    if (rep.pitchingPlan?.starterName) {
      const p = rep.pitchingPlan;
      chunks.push(
        `- Pitching: ${p.starterName}${p.seasonEra ? `, ERA ${p.seasonEra}` : ""}${p.pitchMix[0] ? `, top pitch ${p.pitchMix[0].label} ${pct(p.pitchMix[0].usagePct)}` : ""}.`
      );
    }
    if (rep.hittingTrends?.season) {
      chunks.push(
        `- Hitting: OPS ${rep.hittingTrends.season.ops.toFixed(3)} over ${rep.hittingTrends.season.pa} PA (K ${pct(rep.hittingTrends.season.kPct)}, BB ${pct(rep.hittingTrends.season.bbPct)}).`
      );
    }
    if (rep.gamePlan.length) chunks.push(`- Game plan: ${rep.gamePlan.slice(0, 3).join(" ")}`);
    return chunks.join("\n");
  }

  if (q.includes("ops") || q.includes("k%") || q.includes("bb%") || q.includes("risp")) {
    const ht = rep.hittingTrends;
    if (!ht?.season) return "No hitting trend sample is loaded yet for this game.";
    return [
      `Wider sample (${ht.windowLabel}):`,
      `- OPS ${ht.season.ops.toFixed(3)} in ${ht.season.pa} PA`,
      `- K% ${pct(ht.season.kPct)} | BB% ${pct(ht.season.bbPct)}`,
      `- RISP: ${ht.season.rispSlash}`,
      `- FPS: ${pct(ht.season.fpsPct)}`,
      ht.recent ? `Recent: OPS ${ht.recent.ops.toFixed(3)} in ${ht.recent.pa} PA.` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (q.includes("pitch") || q.includes("starter")) {
    const p = rep.pitchingPlan;
    if (!p) return "No starter plan is loaded for this game yet.";
    const top = p.pitchMix.slice(0, 3).map((x) => `${x.label} ${pct(x.usagePct)}`).join(", ");
    return [
      `${p.starterName ?? "Starter"}${p.seasonIp ? ` (${p.seasonIp} IP` : ""}${p.seasonEra ? `${p.seasonIp ? ", " : " ("}ERA ${p.seasonEra}` : ""}${p.seasonIp || p.seasonEra ? ")" : ""}`,
      p.lastOuting ? `Last outing: ${p.lastOuting}` : "",
      top ? `Pitch mix: ${top}` : p.pitchMixFootnote ?? "No reliable typed pitch mix sample.",
      p.planNotes ? `Staff notes: ${p.planNotes}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (q.includes("matchup") || q.includes("opponent")) {
    return [...rep.matchupInsights, ...rep.opponentObservations]
      .slice(0, 6)
      .map((x) => `- ${x}`)
      .join("\n");
  }

  if (q.includes("plan")) {
    return rep.gamePlan.map((x, i) => `${i + 1}. ${x}`).join("\n");
  }

  return null;
}

async function maybeLlmAnswer(query: string, ctx: ReportsAssistantContext): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const gameLabel = ctx.game ? `${matchupLabelUsFirst(ctx.game, true)} (${ctx.game.date})` : "No game selected";
  const payload = {
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "You are a baseball analytics assistant. Answer ONLY from provided JSON context. If data is missing, clearly say so. Include sample sizes where possible. Keep answer concise.",
      },
      {
        role: "user",
        content: `Question: ${query}\n\nGame: ${gameLabel}\n\nContext JSON:\n${JSON.stringify(ctx.preGameOverview?.report ?? null)}`,
      },
    ],
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { output_text?: string };
  const text = data.output_text?.trim();
  return text && text.length > 0 ? text : null;
}

export async function answerReportsAssistant(
  query: string,
  ctx: ReportsAssistantContext
): Promise<ReportsAssistantResponse> {
  const rules = buildRulesAnswer(query, ctx);
  if (rules) return { answer: rules, source: "rules" };

  const llm = await maybeLlmAnswer(query, ctx);
  if (llm) return { answer: llm, source: "llm" };

  return {
    answer:
      "I can already answer pre-game summary, hitting trends (OPS/K%/BB%/RISP), pitching plan, matchup notes, and game plan for the selected game. Ask one of those directly, or add OPENAI_API_KEY for broader natural-language Q&A.",
    source: "rules",
  };
}
