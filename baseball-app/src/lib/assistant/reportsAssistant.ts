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

function buildGeneralWorkflowAnswer(q: string): string | null {
  const wantsHowTo =
    q.includes("how do i") ||
    q.includes("how to") ||
    q.includes("where do i") ||
    q.includes("where can i") ||
    q.includes("where are") ||
    q.includes("help me");

  if (
    wantsHowTo &&
    (q.includes("record") || q.includes("plate appearance") || q.includes("plate appearances") || q.includes("log pa"))
  ) {
    return [
      "Recording plate appearances:",
      "• Open Analyst → Record (or open a game from Games and use the game log / record flow).",
      "• Pick the game, inning, top/bottom, outs, and base state.",
      "• Choose batter and pitcher, set the result (hit, out, walk, etc.), then save.",
      "• Use the Substitution modal (keyboard shortcut where shown) to swap lineup spots mid-game.",
    ].join("\n");
  }

  if (
    wantsHowTo &&
    (q.includes("lineup") || q.includes("batting order") || q.includes("line up"))
  ) {
    return [
      "Lineups:",
      "• Analyst → Lineup Construction: drag players into slots 1–9 and save named templates.",
      "• Games: when adding or editing a game you can set your side’s lineup in the lineup modal.",
      "• Coach → Lineup: coach-facing editor for today’s game lineup.",
    ].join("\n");
  }

  if (wantsHowTo && q.includes("chart")) {
    return "Analyst → Charts has objective spray / discipline views from your logged data. Pick filters and players there.";
  }
  if (wantsHowTo && q.includes("compare")) {
    return "Analyst → Compare players lets you pick two roster players side by side (drag from the roster or use the URL).";
  }
  if (wantsHowTo && (q.includes("stats") || q.includes("statistics") || q.includes("stat sheet"))) {
    return "Analyst → Stats is the main team batting and pitching sheets with filters (splits, count state in discipline modes, etc.).";
  }

  if (
    wantsHowTo &&
    (q.includes("pregame") || q.includes("pre-game") || q.includes("team trend") || q.includes("scouting packet"))
  ) {
    return "Analyst → Reports: pick your game there, then use Pre-Game for the scouting packet, Team Trends for rolling team stats, and other tabs (post-game, players) as needed.";
  }

  if (wantsHowTo && (q.includes("matchup") || q.includes("game plan")) && q.includes("report")) {
    return "Analyst → Reports → Pre-Game: matchup insights and game plan live in that scouting layout (and related sections). Pick the game on the Reports page first.";
  }

  if (wantsHowTo && q.includes("report")) {
    return "Analyst sidebar → Reports opens the reports hub: pre-game scouting packet, post-game snapshot, player PDFs, team trends, and export. The Assistant page links there for full print layouts.";
  }

  return null;
}

function needsPreGameReportForRules(q: string): boolean {
  return (
    q.includes("pregame") ||
    q.includes("pre-game") ||
    q.includes("full report") ||
    (q.includes("summary") && !q.includes("how")) ||
    q.includes("ops") ||
    q.includes("k%") ||
    q.includes("bb%") ||
    q.includes("bb %") ||
    q.includes("k %") ||
    q.includes("risp") ||
    (q.includes("pitch") && !q.includes("pitcher change")) ||
    q.includes("starter") ||
    q.includes("matchup") ||
    q.includes("opponent") ||
    (q.includes("plan") && (q.includes("game") || q.includes("gameday")))
  );
}

function buildRulesAnswer(queryRaw: string, ctx: ReportsAssistantContext): string | null {
  const q = queryRaw.toLowerCase();

  const general = buildGeneralWorkflowAnswer(q);
  if (general) return general;

  const rep = ctx.preGameOverview?.report;
  if (!rep) {
    if (needsPreGameReportForRules(q)) {
      return "This chat isn’t tied to one game’s loaded scouting packet. For exact pre-game summaries, OPS/K%/BB%/RISP from the report JSON, pitching plan, or matchup bullets, open Analyst → Reports, pick the game there, or name the date/opponent in your message. Team trend notes are still passed when available; how-to questions (Recording, Lineups, Stats, Reports) work anytime.";
    }
    return null;
  }

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
    const rispExtras: string[] = [];
    if (ht.season.rispPpa != null && Number.isFinite(ht.season.rispPpa)) {
      rispExtras.push(`P/PA ${ht.season.rispPpa.toFixed(1)}`);
    }
    if (ht.season.rispKPct != null) rispExtras.push(`K% ${pct(ht.season.rispKPct)}`);
    if (ht.season.rispBbPct != null) rispExtras.push(`BB% ${pct(ht.season.rispBbPct)}`);
    const rispBits =
      rispExtras.length > 0 ? `${ht.season.rispSlash} · ${rispExtras.join(" · ")}` : ht.season.rispSlash;
    return [
      `Wider sample (${ht.windowLabel}):`,
      `- OPS ${ht.season.ops.toFixed(3)} in ${ht.season.pa} PA`,
      `- K% ${pct(ht.season.kPct)} | BB% ${pct(ht.season.bbPct)}`,
      `- RISP: ${rispBits}`,
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

  const gameLabel = ctx.game ? `${matchupLabelUsFirst(ctx.game, true)} (${ctx.game.date})` : "No single game pinned (user may name one in the question)";
  const trendLines = ctx.teamTrendInsights.length
    ? ctx.teamTrendInsights.slice(0, 24).join("\n")
    : "(none)";
  const payload = {
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "You are an assistant for a baseball analytics web app. There is usually no pinned game or pre-game JSON—only team trend bullets and the user’s question (they may name a matchup in text). Use trend bullets when relevant. For game-specific scouting stats, direct them to Analyst → Reports or ask them to name the game. For how-to (recording PAs, lineups, reports, stats, coach tools), give short navigation steps. If data is missing, say so. Keep answers concise.",
      },
      {
        role: "user",
        content: `Question: ${query}\n\nGame: ${gameLabel}\n\nTeam trend notes:\n${trendLines}\n\nPre-game report JSON (may be null):\n${JSON.stringify(ctx.preGameOverview?.report ?? null)}`,
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
      "Try how-to questions (recording PAs, lineups, Stats, Reports, Charts) or describe what you need—mention a date or opponent for game-specific help. For loaded scouting numbers, use the Reports hub. With OPENAI_API_KEY set, open-ended questions can use team trend notes from context.",
    source: "rules",
  };
}
