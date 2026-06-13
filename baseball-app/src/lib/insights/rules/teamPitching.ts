import {
  aggregatePitchTypeBucketCounts,
  pitchTypeProfilesFromCounts,
  normalizePitchTypeBucket,
} from "@/lib/compute/pitchTypeProfileFromPas";
import { groupPitchEventsByPaId } from "@/lib/compute/contactProfileFromPas";
import { pitchOutcomeIsSwing } from "@/lib/compute/pitchSequence";
import { pitchTrackerTypeLabel } from "@/lib/pitchTrackerUi";
import { fmtDecimalNoLeadingZero } from "@/lib/format";
import { assignPriority } from "../priority";
import type { Insight } from "../types";
import type { InsightsContext } from "../context";
import { clubPitcherIds } from "../context";
import { flatOurBattingPas, sliceGamesNewestFirst } from "../windows";
import type { Game, PitchEvent, PlateAppearance } from "@/lib/types";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function insight(partial: Omit<Insight, "priority"> & { magnitude?: number }): Insight {
  const { magnitude, ...rest } = partial;
  return { ...rest, priority: assignPriority({ kind: rest.kind, confidence: rest.confidence, magnitude }) };
}

function ourPitchingPas(ctx: InsightsContext, games: Game[]): PlateAppearance[] {
  const pitcherIds = clubPitcherIds(ctx);
  const battingPas = flatOurBattingPas([...games].reverse(), ctx.allPas);
  void battingPas;
  const gameIds = new Set(games.map((g) => g.id));
  return ctx.allPas.filter(
    (p) => gameIds.has(p.game_id) && p.pitcher_id && pitcherIds.has(p.pitcher_id)
  );
}

function pitchLogMetrics(pas: PlateAppearance[], events: PitchEvent[]) {
  const byPa = groupPitchEventsByPaId(events);
  let pitches = 0;
  let strikes = 0;
  let swings = 0;
  let whiffs = 0;
  for (const pa of pas) {
    const evs = byPa.get(pa.id) ?? [];
    for (const e of evs) {
      pitches += 1;
      if (e.outcome === "called_strike" || e.outcome === "swinging_strike" || e.outcome === "foul") {
        strikes += 1;
      }
      if (pitchOutcomeIsSwing(e.outcome)) {
        swings += 1;
        if (e.outcome === "swinging_strike") whiffs += 1;
      }
    }
  }
  return {
    pitches,
    strikePct: pitches > 0 ? strikes / pitches : null,
    whiffPct: swings > 0 ? whiffs / swings : null,
  };
}

export function runTeamPitchingRules(ctx: InsightsContext): Insight[] {
  const insights: Insight[] = [];
  const games = ctx.gamesNewestFirst;
  if (games.length === 0) return insights;

  const last3Games = sliceGamesNewestFirst(games, "last_3");
  const prev3Games = games.slice(3, 6);
  const last3Pas = ourPitchingPas(ctx, last3Games);
  const prev3Pas = ourPitchingPas(ctx, prev3Games);
  const seasonPas = ourPitchingPas(ctx, games);

  const last3Log = pitchLogMetrics(last3Pas, ctx.pitchEvents);
  const prev3Log = pitchLogMetrics(prev3Pas, ctx.pitchEvents);

  if (
    last3Log.strikePct != null &&
    prev3Log.strikePct != null &&
    last3Log.pitches >= 40 &&
    prev3Log.pitches >= 40
  ) {
    const d = last3Log.strikePct - prev3Log.strikePct;
    if (Math.abs(d) >= 0.04) {
      insights.push(
        insight({
          id: "team_pitching.strike_pct_trend",
          kind: "observation",
          category: "trend",
          title:
            d > 0
              ? `Pitching strike percentage trending up (${pct(last3Log.strikePct)} vs ${pct(prev3Log.strikePct)} prior sample).`
              : `Pitching strike percentage declining (${pct(last3Log.strikePct)} vs ${pct(prev3Log.strikePct)} prior sample).`,
          trend: d > 0 ? "up" : "down",
          evidence: [
            { label: "Strike % (last 3)", value: pct(last3Log.strikePct) },
            { label: "Prior sample", value: pct(prev3Log.strikePct) },
          ],
          confidence: "medium",
          magnitude: Math.abs(d),
        })
      );
    }
  }

  if (
    last3Log.whiffPct != null &&
    prev3Log.whiffPct != null &&
    last3Log.pitches >= 40 &&
    prev3Log.pitches >= 40
  ) {
    const d = last3Log.whiffPct - prev3Log.whiffPct;
    if (Math.abs(d) >= 0.05) {
      insights.push(
        insight({
          id: "team_pitching.whiff_trend",
          kind: "observation",
          category: "trend",
          title:
            d > 0
              ? `Whiff percentage trending up (${pct(last3Log.whiffPct)} vs ${pct(prev3Log.whiffPct)}).`
              : `Whiff percentage trending down (${pct(last3Log.whiffPct)} vs ${pct(prev3Log.whiffPct)}).`,
          trend: d > 0 ? "up" : "down",
          evidence: [
            { label: "Whiff %", value: pct(last3Log.whiffPct) },
            { label: "Prior", value: pct(prev3Log.whiffPct) },
          ],
          confidence: "medium",
          magnitude: Math.abs(d),
        })
      );
    }
  }

  if (seasonPas.length >= 10 && ctx.pitchEvents.length >= 30) {
    const byPa = groupPitchEventsByPaId(ctx.pitchEvents);
    const agg = aggregatePitchTypeBucketCounts(seasonPas, byPa);
    const profiles = pitchTypeProfilesFromCounts(agg.typedTotal, agg.buckets, {
      totalFirstPitch: agg.totalFirstPitch,
      totalAhead: agg.totalAhead,
      totalBehind: agg.totalBehind,
      totalEven: agg.totalEven,
      totalPaEnds: agg.totalPaEnds,
    });

    let bestWhiff: { key: string; whiff: number; n: number } | null = null;
    let worstAvg: { key: string; avg: number; ab: number } | null = null;
    for (const [key, prof] of Object.entries(profiles)) {
      const bucket = normalizePitchTypeBucket(key);
      if (!bucket || !prof) continue;
      const whiff = prof.whiffPct ?? 0;
      const n = prof.pitches ?? 0;
      if (n >= 8 && whiff > 0 && (!bestWhiff || whiff > bestWhiff.whiff)) {
        bestWhiff = { key: bucket, whiff, n };
      }
      const ab = prof.ab ?? 0;
      const avg = prof.baa ?? 0;
      if (ab >= 6 && (!worstAvg || avg > worstAvg.avg)) {
        worstAvg = { key: bucket, avg, ab };
      }
    }

    if (bestWhiff && bestWhiff.whiff >= 0.35) {
      insights.push(
        insight({
          id: "team_pitching.best_whiff_pitch",
          kind: "observation",
          category: "pitch_type",
          title: `${pitchTrackerTypeLabel(bestWhiff.key as never)} generated a team-high ${pct(bestWhiff.whiff)} whiff rate.`,
          evidence: [{ label: "Whiff %", value: pct(bestWhiff.whiff) }],
          confidence: bestWhiff.n >= 20 ? "high" : "medium",
        })
      );
    }
    if (worstAvg && worstAvg.avg >= 0.3) {
      insights.push(
        insight({
          id: "team_pitching.worst_avg_pitch",
          kind: "observation",
          category: "pitch_type",
          title: `${pitchTrackerTypeLabel(worstAvg.key as never)} has allowed ${fmtDecimalNoLeadingZero(worstAvg.avg, 3)} AVG against (${worstAvg.ab} AB).`,
          evidence: [{ label: "AVG against", value: fmtDecimalNoLeadingZero(worstAvg.avg, 3) }],
          confidence: "medium",
        })
      );
    }
  }

  return insights;
}
