/**
 * Structured coach pre-game report sections from logged games, PAs, and pitch events.
 */

import { battingStatsFromPAs, isRisp } from "@/lib/compute/battingStats";
import { groupPitchEventsByPaId } from "@/lib/compute/contactProfileFromPas";
import { aggregatePitchTypeBuckets, normalizePitchTypeBucket } from "@/lib/compute/pitchTypeProfileFromPas";
import { pitchTrackerTypeLabel } from "@/lib/pitchTrackerUi";
import { matchupLabelUsFirst, opponentTeamName, ourTeamName } from "@/lib/opponentUtils";
import { pasOurTeamBatting } from "@/lib/reports/postGameSnapshot";
import type {
  BattingStatsWithSplits,
  Game,
  PitchEvent,
  PitchingStats,
  PitchTrackerPitchType,
  PlateAppearance,
  Player,
} from "@/lib/types";
import type { PreGameOurStarterSummary, PreGamePriorMeeting, PreGameRecentHitterLine } from "@/lib/reports/preGameReportTypes";

const MIN_TEAM_PA = 12;
const MIN_RISP_PA = 5;
const MIN_HOT_COLD_RECENT = 4;
const MIN_HOT_COLD_SEASON = 8;
const HOT_COLD_OPS_DELTA = 0.12;

export type PreGamePitchMixRow = {
  label: string;
  usagePct: number;
  strikePct: number | null;
  whiffPct: number | null;
  pitches: number;
};

export type PreGameHittingSnapshot = {
  pa: number;
  ops: number;
  kPct: number;
  bbPct: number;
  rispSlash: string;
  rispHab: string;
  fpsPct: number | null;
};

export type PreGameReportSections = {
  gameContext: { bullets: string[] };
  pitchingPlan: {
    starterName: string | null;
    seasonIp: string | null;
    seasonEra: string | null;
    lastOuting: string | null;
    planNotes: string | null;
    pitchMix: PreGamePitchMixRow[];
    pitchMixFootnote: string | null;
  } | null;
  hittingTrends: {
    windowLabel: string;
    season: PreGameHittingSnapshot | null;
    recent: PreGameHittingSnapshot | null;
    insights: string[];
  } | null;
  playerInsights: {
    hot: Array<{ name: string; line: string }>;
    cold: Array<{ name: string; line: string }>;
  };
  opponentObservations: string[];
  matchupInsights: string[];
  gamePlan: string[];
};

function flatOurTeamBatting(games: Game[], pasAll: PlateAppearance[]): PlateAppearance[] {
  const byGame = new Map<string, PlateAppearance[]>();
  for (const p of pasAll) {
    const list = byGame.get(p.game_id) ?? [];
    list.push(p);
    byGame.set(p.game_id, list);
  }
  const out: PlateAppearance[] = [];
  for (const g of games) {
    const chunk = byGame.get(g.id);
    if (chunk?.length) out.push(...pasOurTeamBatting(g, chunk));
  }
  return out;
}

function hittingSnapshotFromPas(pas: PlateAppearance[]): PreGameHittingSnapshot | null {
  if (pas.length < 1) return null;
  const st = battingStatsFromPAs(pas);
  if (!st) return null;
  const risp = pas.filter((p) => isRisp(p.base_state));
  const rSt = risp.length > 0 ? battingStatsFromPAs(risp) : null;
  const rispSlash =
    rSt && (rSt.pa ?? 0) >= 1
      ? `${(rSt.avg ?? 0).toFixed(3)}/${(rSt.obp ?? 0).toFixed(3)}/${(rSt.slg ?? 0).toFixed(3)} (${rSt.pa ?? 0} PA)`
      : risp.length >= 1
        ? `${risp.length} PA (insufficient for slash)`
        : "—";
  const rispHab =
    rSt && (rSt.pa ?? 0) >= 1
      ? `${rSt.h ?? 0}-${rSt.ab ?? 0}`
      : "—";

  const fpsDenom = pas.filter((p) => p.first_pitch_strike != null).length;
  const fpsPct = fpsDenom > 0 ? pas.filter((p) => p.first_pitch_strike === true).length / fpsDenom : null;

  return {
    pa: st.pa ?? pas.length,
    ops: st.ops,
    kPct: st.kPct ?? 0,
    bbPct: st.bbPct ?? 0,
    rispSlash,
    rispHab,
    fpsPct,
  };
}

function pitchMixRows(pas: PlateAppearance[], events: PitchEvent[]): {
  rows: PreGamePitchMixRow[];
  footnote: string | null;
} {
  if (pas.length === 0) return { rows: [], footnote: "No logged mound appearances in this window." };
  const eventsByPaId = groupPitchEventsByPaId(events);
  const { typedTotal, buckets } = aggregatePitchTypeBuckets(pas, eventsByPaId);
  if (typedTotal < 8) {
    return {
      rows: [],
      footnote:
        typedTotal < 1
          ? "No pitch types logged for this pitcher in the sample—use staff notes below."
          : `Only ${typedTotal} typed pitches logged—treat mix as directional.`,
    };
  }

  type Key = keyof typeof buckets;
  const entries = (Object.keys(buckets) as Key[])
    .map((k) => ({ key: k, ...buckets[k] }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 6);

  const rows: PreGamePitchMixRow[] = entries.map(({ key, n, swings, whiffs }) => {
    const label = key === "other" ? "Other" : pitchTrackerTypeLabel(key as PitchTrackerPitchType);
    let strikes = 0;
    const evs = events.filter((e) => {
      const b = normalizePitchTypeBucket(e.pitch_type);
      const match = b === key || (key === "other" && b === "other");
      return match;
    });
    for (const e of evs) {
      if (e.outcome === "called_strike" || e.outcome === "swinging_strike" || e.outcome === "foul") strikes += 1;
    }
    const strikePct = n > 0 ? strikes / n : null;
    const whiffPct = swings > 0 ? whiffs / swings : null;
    return {
      label,
      usagePct: typedTotal > 0 ? n / typedTotal : 0,
      strikePct,
      whiffPct,
      pitches: n,
    };
  });

  return { rows, footnote: null };
}

function priorSeriesLine(meetings: PreGamePriorMeeting[]): string | null {
  let w = 0;
  let l = 0;
  let t = 0;
  for (const m of meetings) {
    if (m.outcome === "W") w += 1;
    else if (m.outcome === "L") l += 1;
    else if (m.outcome === "T") t += 1;
  }
  const dec = w + l + t;
  if (dec === 0) return null;
  const tie = t > 0 ? `, ${t} tie${t > 1 ? "s" : ""}` : "";
  return `${w}-${l}${tie} in ${dec} logged meeting${dec > 1 ? "s" : ""}`;
}

export function buildPreGameReport(input: {
  game: Game;
  /** Newest-first games in the team metrics window (e.g. last 25 before this game). */
  seasonGamesNewestFirst: Game[];
  /** Newest-first recent games (subset of season window). */
  recentGamesNewestFirst: Game[];
  pasInSeasonWindow: PlateAppearance[];
  ourStarterId: string | null;
  /** Pitch events for PAs where our starter was on the mound in the season window. */
  pitchEventsOurStarter: PitchEvent[];
  oppStarterVsOur: PitchingStats | null;
  ourStarterSummary: PreGameOurStarterSummary | null;
  priorMeetings: PreGamePriorMeeting[];
  ourLineupIds: string[];
  opponentLineupIds: string[];
  lineupStatsByPlayerId: Record<string, BattingStatsWithSplits>;
  recentHitterLineByPlayerId: Record<string, PreGameRecentHitterLine | null>;
  playersById: Record<string, Player>;
  teamTrendInsights: string[];
}): PreGameReportSections {
  const {
    game,
    seasonGamesNewestFirst,
    recentGamesNewestFirst,
    pasInSeasonWindow,
    ourStarterId,
    pitchEventsOurStarter,
    oppStarterVsOur,
    ourStarterSummary,
    priorMeetings,
    ourLineupIds,
    opponentLineupIds,
    lineupStatsByPlayerId,
    recentHitterLineByPlayerId,
    playersById,
    teamTrendInsights,
  } = input;

  const us = ourTeamName(game);
  const them = opponentTeamName(game);

  const gameContextBullets: string[] = [];
  gameContextBullets.push(`${matchupLabelUsFirst(game, true)} — ${us} is the ${game.our_side === "home" ? "home" : "away"} team vs ${them}.`);
  const series = priorSeriesLine(priorMeetings);
  if (series) gameContextBullets.push(`Vs ${them} before today: ${series}.`);
  else if (priorMeetings.length === 0) gameContextBullets.push(`No earlier logged games vs ${them} on this schedule.`);

  const seasonChrono = [...seasonGamesNewestFirst].reverse();
  const recentChrono = [...recentGamesNewestFirst].reverse();
  const seasonOur = flatOurTeamBatting(seasonChrono, pasInSeasonWindow);
  const recentOur = flatOurTeamBatting(recentChrono, pasInSeasonWindow);

  const seasonSnap = seasonOur.length >= MIN_TEAM_PA ? hittingSnapshotFromPas(seasonOur) : null;
  const recentSnap = recentOur.length >= 8 ? hittingSnapshotFromPas(recentOur) : null;

  const hittingInsights: string[] = [];
  if (seasonSnap && seasonSnap.pa >= MIN_RISP_PA) {
    const rispPas = seasonOur.filter((p) => isRisp(p.base_state));
    if (rispPas.length >= MIN_RISP_PA) {
      const r = battingStatsFromPAs(rispPas);
      if (r && (r.ops ?? 0) < 0.6) hittingInsights.push(`RISP OPS has been thin (${(r.ops ?? 0).toFixed(3)}) over ${rispPas.length} PA in the sample—pressure situations matter today.`);
      if (r && (r.ops ?? 0) > 0.85) hittingInsights.push(`RISP production has been a strength (OPS ${(r.ops ?? 0).toFixed(3)} on ${rispPas.length} PA).`);
    }
  }
  if (recentSnap && seasonSnap && recentSnap.pa >= 8) {
    if (recentSnap.ops - seasonSnap.ops > 0.08) hittingInsights.push(`Last few games: OPS trending up vs the wider sample (${recentSnap.ops.toFixed(3)} vs ${seasonSnap.ops.toFixed(3)}).`);
    if (seasonSnap.ops - recentSnap.ops > 0.08) hittingInsights.push(`Recent OPS (${recentSnap.ops.toFixed(3)}) is below the wider sample (${seasonSnap.ops.toFixed(3)})—small window, but worth a conversation.`);
  }
  for (const line of teamTrendInsights.slice(0, 2)) {
    if (!hittingInsights.includes(line)) hittingInsights.push(line);
  }

  const windowLabel =
    seasonGamesNewestFirst.length > 0
      ? `Last ${seasonGamesNewestFirst.length} completed team games before this one`
      : "No completed games before this date";

  let pitchingPlan: PreGameReportSections["pitchingPlan"] = null;
  if (ourStarterSummary || ourStarterId) {
    const starterPas =
      ourStarterId != null
        ? pasInSeasonWindow.filter((p) => p.pitcher_id === ourStarterId)
        : [];
    const { rows, footnote } = pitchMixRows(starterPas, pitchEventsOurStarter);
    pitchingPlan = {
      starterName: ourStarterSummary?.name ?? (ourStarterId ? playersById[ourStarterId]?.name ?? null : null),
      seasonIp: ourStarterSummary?.seasonIpDisplay ?? null,
      seasonEra: ourStarterSummary?.seasonEra ?? null,
      lastOuting: ourStarterSummary?.lastOutingLine ?? null,
      planNotes: ourStarterSummary?.planNotes ?? null,
      pitchMix: rows,
      pitchMixFootnote: footnote,
    };
  }

  const hot: Array<{ name: string; line: string }> = [];
  const cold: Array<{ name: string; line: string }> = [];
  for (const pid of ourLineupIds) {
    const p = playersById[pid];
    const name = p?.name ?? "Unknown";
    const season = lineupStatsByPlayerId[pid]?.overall;
    const recent = recentHitterLineByPlayerId[pid];
    const sPa = season?.pa ?? 0;
    const rPa = recent?.pa ?? 0;
    if (sPa < MIN_HOT_COLD_SEASON || rPa < MIN_HOT_COLD_RECENT) continue;
    const d = (recent?.ops ?? 0) - (season?.ops ?? 0);
    if (d >= HOT_COLD_OPS_DELTA) {
      hot.push({
        name,
        line: `Recent ${rPa} PA: OPS ${recent!.ops.toFixed(3)} vs season ${(season?.ops ?? 0).toFixed(3)} (${sPa} PA)`,
      });
    } else if (d <= -HOT_COLD_OPS_DELTA) {
      cold.push({
        name,
        line: `Recent ${rPa} PA: OPS ${recent!.ops.toFixed(3)} vs season ${(season?.ops ?? 0).toFixed(3)} (${sPa} PA)`,
      });
    }
  }

  const opponentObservations: string[] = [];
  type OppoRow = { name: string; kPct: number; bbPct: number; pa: number; ops: number };
  const oppoRows: OppoRow[] = [];
  for (const pid of opponentLineupIds) {
    const o = lineupStatsByPlayerId[pid]?.overall;
    const p = playersById[pid];
    if (!o || (o.pa ?? 0) < 5) continue;
    oppoRows.push({
      name: p?.name ?? "Unknown",
      kPct: o.kPct ?? 0,
      bbPct: o.bbPct ?? 0,
      pa: o.pa ?? 0,
      ops: o.ops ?? 0,
    });
  }
  if (oppoRows.length > 0) {
    const byK = [...oppoRows].sort((a, b) => b.kPct - a.kPct)[0]!;
    if (byK && byK.pa >= 8 && byK.kPct >= 0.28) {
      opponentObservations.push(
        `${byK.name} shows swing-and-miss in the logged sample (${Math.round(byK.kPct * 100)}% K% over ${byK.pa} PA).`
      );
    }
    const patient = oppoRows.filter((x) => x.bbPct >= 0.14 && x.pa >= 8).sort((a, b) => b.bbPct - a.bbPct)[0];
    if (patient) {
      opponentObservations.push(
        `${patient.name} has been patient (${Math.round(patient.bbPct * 100)}% BB% over ${patient.pa} PA)—force early contact when ahead.`
      );
    }
    const dangerous = [...oppoRows].sort((a, b) => b.ops - a.ops)[0]!;
    if (dangerous && dangerous.pa >= 8 && dangerous.ops >= 0.8) {
      opponentObservations.push(`${dangerous.name} leads this lineup group in logged OPS (${dangerous.ops.toFixed(3)}).`);
    }
  }
  if (opponentLineupIds.length > 0 && opponentObservations.length === 0) {
    opponentObservations.push("Limited opponent PA history in the database—lean on live eyes and the lineup card.");
  }

  const matchupInsights: string[] = [];
  const oppSp = game.our_side === "home" ? game.starting_pitcher_away_id : game.starting_pitcher_home_id;
  const oppThrows = oppSp ? playersById[oppSp]?.throws : null;
  if (oppThrows && ourLineupIds.length > 0) {
    let l = 0;
    let r = 0;
    let s = 0;
    for (const id of ourLineupIds) {
      const b = playersById[id]?.bats;
      if (b === "L") l += 1;
      else if (b === "R") r += 1;
      else if (b === "S") s += 1;
    }
    const handed = oppThrows === "L" ? "LHP" : "RHP";
    matchupInsights.push(`Their listed starter is a ${handed}. Lineup: ${l} L / ${r} R / ${s} S among saved slots.`);
  }
  if (oppStarterVsOur && (oppStarterVsOur.ip ?? 0) > 0) {
    const k = oppStarterVsOur.rates?.kPct ?? 0;
    const bb = oppStarterVsOur.rates?.bbPct ?? 0;
    matchupInsights.push(
      `Vs ${us} in logged PAs: ${oppStarterVsOur.ipDisplay} IP, ERA ${Number.isFinite(oppStarterVsOur.era) ? oppStarterVsOur.era.toFixed(2) : "—"}, WHIP ${oppStarterVsOur.whip?.toFixed(2) ?? "—"}, K% ${Math.round(k * 100)}, BB% ${Math.round(bb * 100)}.`
    );
  } else if (oppSp) {
    matchupInsights.push("No sizable vs–us sample yet for their starter—use overall spray and tonight’s velo/movement.");
  }

  const gamePlan: string[] = [];
  if (pitchingPlan?.planNotes) gamePlan.push(`Starter plan (staff): ${pitchingPlan.planNotes}`);
  if (pitchingPlan?.pitchMix.length) {
    const top = pitchingPlan.pitchMix[0]!;
    gamePlan.push(`Expect heavy ${top.label} usage (${Math.round(top.usagePct * 100)}% of typed pitches in the sample)—gameplan secondary stuff off that.`);
  }
  if (seasonSnap && seasonSnap.kPct > 0.27) {
    gamePlan.push("Offensively: shorten swings with two strikes and force deeper counts in first trip through.");
  }
  if (hot.length > 0) gamePlan.push(`Ride the hot hands at the top of the order (${hot[0]!.name}); keep late-inning options ready for matchups.`);
  if (
    oppStarterVsOur &&
    (oppStarterVsOur.ip ?? 0) >= 3 &&
    ((oppStarterVsOur.era ?? 0) >= 4.8 || (oppStarterVsOur.whip ?? 0) >= 1.45)
  ) {
    gamePlan.push("Past logged matchups vs this starter have been favorable on the mound—repeat approaches that worked, but watch for arsenal tweaks.");
  }
  if (gamePlan.length < 3) {
    gamePlan.push("Defensively: align to spray data from practice and past series; communicate pickoffs and 1st-and-3rd coverage.");
  }
  if (gamePlan.length < 4) {
    gamePlan.push("Late: know the high-leverage reliever roles before first pitch.");
  }
  const gamePlanDedup = [...new Set(gamePlan)].slice(0, 6);

  return {
    gameContext: { bullets: gameContextBullets },
    pitchingPlan,
    hittingTrends:
      seasonSnap || recentSnap
        ? {
            windowLabel,
            season: seasonSnap,
            recent: recentSnap,
            insights: hittingInsights.slice(0, 8),
          }
        : null,
    playerInsights: { hot: hot.slice(0, 4), cold: cold.slice(0, 4) },
    opponentObservations: opponentObservations.slice(0, 5),
    matchupInsights: matchupInsights.slice(0, 5),
    gamePlan: gamePlanDedup,
  };
}
