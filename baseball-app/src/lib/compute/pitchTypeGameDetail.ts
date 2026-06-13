import { pitchOutcomeIsSwing } from "@/lib/compute/pitchSequence";
import { isPitchTrackerPitchType } from "@/lib/pitchTrackerUi";
import type {
  PAResult,
  PitchEvent,
  PitchTrackerPitchType,
  PlateAppearance,
} from "@/lib/types";

/** Every in-game stat for one coach pitch type (one pitcher's PAs + pitch log). */
export interface PitchTypeGameDetail {
  type: PitchTrackerPitchType;
  /** Pitches of this type in the log. */
  thrown: number;
  /** Pitches in the log with any recognized type (mix denominator). */
  typedTotal: number;
  mixPct: number | null;

  balls: number;
  calledStrikes: number;
  swingingStrikes: number;
  fouls: number;
  inPlay: number;
  /** Called + swinging + foul + in play. */
  strikes: number;
  strikePct: number | null;
  /** Called strikes + whiffs ÷ thrown. */
  cswPct: number | null;

  swings: number;
  swingPct: number | null;
  whiffPct: number | null;
  foulPct: number | null;
  /** Swings that made contact ÷ swings. */
  contactPct: number | null;

  /** Thrown at 0-0. */
  firstPitches: number;
  firstPitchStrikes: number;
  /** First-pitch strikes ÷ first pitches (0-0). */
  firstPitchStrikePct: number | null;
  /** Count state when thrown (before the pitch). */
  ahead: number;
  even: number;
  behind: number;

  /** Thrown with 2 strikes on the batter. */
  twoStrikePitches: number;
  twoStrikeSwings: number;
  twoStrikeWhiffs: number;
  twoStrikeFouls: number;
  twoStrikeSwingPct: number | null;
  twoStrikeWhiffPct: number | null;
  twoStrikeContactPct: number | null;
  twoStrikeFoulPct: number | null;
  /** PAs that ended in a strikeout on this pitch type. */
  putawayKs: number;
  putawayPct: number | null;

  /** Completed PAs whose final pitch was this type. */
  paEnded: number;
  endKs: number;
  endWalks: number;
  endHits: number;
  endOuts: number;
  endOther: number;

  /** AB that ended on this pitch (excludes BB, IBB, HBP, sacs). */
  abAgainst: number;
  hitsAgainst: number;
  baa: number | null;
  /** K% on terminal sample: SO ÷ (AB + SO). */
  kPct: number | null;
  /** BB + IBB + HBP ÷ PAs ended on this pitch. */
  bbPct: number | null;
  slg: number | null;
  hrAgainst: number;

  /** PA-ending balls in play on this type with a tagged batted-ball type. */
  bipTagged: number;
  bipGb: number;
  bipLd: number;
  bipFb: number;
  bipIff: number;
  /** Tagged BIP mix (denominator: `bipTagged`). */
  bipGbPct: number | null;
  bipLdPct: number | null;
  bipFbPct: number | null;
  bipIffPct: number | null;
  /** PA-ending BIP on this type tagged hard contact. */
  bipHard: number;
}

const HIT_RESULTS = new Set<PAResult>(["single", "double", "triple", "hr"]);
const PA_NON_AB_RESULTS = new Set<PAResult>(["bb", "ibb", "hbp", "sac_fly", "sac", "sac_bunt"]);
const OUT_RESULTS = new Set<PAResult>([
  "out",
  "foul_out",
  "sac",
  "sac_fly",
  "sac_bunt",
  "gidp",
  "fielders_choice",
]);

function normalizeType(raw: string | null | undefined): PitchTrackerPitchType | null {
  if (raw == null) return null;
  const t = String(raw).trim().toLowerCase();
  return isPitchTrackerPitchType(t) ? t : null;
}

/**
 * Aggregates every stat we track for `pitchType` from one pitcher's PAs and pitch log
 * (this game). PA-level endings skip `result: "other"` rows (e.g. the live coach AB).
 *
 * `mixEvents` (optional): superset including typed pitches whose ball/strike result is
 * still pending — used for `thrown` / `typedTotal` / `mixPct` so the modal ticks up the
 * moment the coach logs a pitch. Outcome rates keep resolved-pitch denominators.
 */
export function pitchTypeGameDetailFromPas(
  pas: PlateAppearance[],
  events: PitchEvent[],
  pitchType: PitchTrackerPitchType,
  mixEvents?: PitchEvent[]
): PitchTypeGameDetail {
  const paIds = new Set(pas.map((p) => p.id));
  const scoped = events.filter((e) => paIds.has(e.pa_id));

  let typedTotal = 0;
  let thrown = 0;
  let balls = 0;
  let calledStrikes = 0;
  let swingingStrikes = 0;
  let fouls = 0;
  let inPlay = 0;
  let firstPitches = 0;
  let firstPitchStrikes = 0;
  let ahead = 0;
  let even = 0;
  let behind = 0;
  let twoStrikePitches = 0;
  let twoStrikeSwings = 0;
  let twoStrikeWhiffs = 0;
  let twoStrikeFouls = 0;

  const lastEventByPa = new Map<string, PitchEvent>();

  for (const e of scoped) {
    const prev = lastEventByPa.get(e.pa_id);
    if (prev == null || e.pitch_index > prev.pitch_index) lastEventByPa.set(e.pa_id, e);

    const nt = normalizeType(e.pitch_type);
    if (nt == null) continue;
    typedTotal += 1;
    if (nt !== pitchType) continue;

    thrown += 1;
    switch (e.outcome) {
      case "ball":
        balls += 1;
        break;
      case "called_strike":
        calledStrikes += 1;
        break;
      case "swinging_strike":
        swingingStrikes += 1;
        break;
      case "foul":
        fouls += 1;
        break;
      case "in_play":
        inPlay += 1;
        break;
      default:
        break; // hbp: counted in thrown only
    }

    if (e.balls_before === 0 && e.strikes_before === 0) {
      firstPitches += 1;
      if (e.outcome !== "ball" && e.outcome !== "hbp") firstPitchStrikes += 1;
    }
    if (e.strikes_before > e.balls_before) ahead += 1;
    else if (e.strikes_before < e.balls_before) behind += 1;
    else even += 1;
    if (e.strikes_before === 2) {
      twoStrikePitches += 1;
      if (pitchOutcomeIsSwing(e.outcome)) {
        twoStrikeSwings += 1;
        if (e.outcome === "swinging_strike") twoStrikeWhiffs += 1;
      }
      if (e.outcome === "foul") twoStrikeFouls += 1;
    }
  }

  const strikes = calledStrikes + swingingStrikes + fouls + inPlay;
  const swings = swingingStrikes + fouls + inPlay;

  let paEnded = 0;
  let endKs = 0;
  let endWalks = 0;
  let endHits = 0;
  let endOuts = 0;
  let endOther = 0;
  let abAgainst = 0;
  let hitsAgainst = 0;
  let terminalSo = 0;
  let terminalBb = 0;
  let terminalIbb = 0;
  let terminalHbp = 0;
  let terminalSingle = 0;
  let terminal2b = 0;
  let terminal3b = 0;
  let hrAgainst = 0;
  let bipTagged = 0;
  let bipGb = 0;
  let bipLd = 0;
  let bipFb = 0;
  let bipIff = 0;
  let bipHard = 0;

  for (const pa of pas) {
    if (pa.result === "other") continue;
    const last = lastEventByPa.get(pa.id);
    if (last == null || normalizeType(last.pitch_type) !== pitchType) continue;

    paEnded += 1;
    if (pa.result === "so" || pa.result === "so_looking") {
      endKs += 1;
      terminalSo += 1;
    } else if (pa.result === "bb" || pa.result === "ibb") endWalks += 1;
    else if (HIT_RESULTS.has(pa.result)) endHits += 1;
    else if (OUT_RESULTS.has(pa.result)) endOuts += 1;
    else endOther += 1;

    if (pa.result === "bb") terminalBb += 1;
    if (pa.result === "ibb") terminalIbb += 1;
    if (pa.result === "hbp") terminalHbp += 1;

    if (!PA_NON_AB_RESULTS.has(pa.result)) {
      abAgainst += 1;
      if (HIT_RESULTS.has(pa.result)) hitsAgainst += 1;
      if (pa.result === "single") terminalSingle += 1;
      else if (pa.result === "double") terminal2b += 1;
      else if (pa.result === "triple") terminal3b += 1;
      else if (pa.result === "hr") hrAgainst += 1;
    }

    if (last.outcome === "in_play") {
      if (pa.batted_ball_type != null) {
        bipTagged += 1;
        if (pa.batted_ball_type === "ground_ball") bipGb += 1;
        else if (pa.batted_ball_type === "line_drive") bipLd += 1;
        else if (pa.batted_ball_type === "fly_ball") bipFb += 1;
        else if (pa.batted_ball_type === "infield_fly") bipIff += 1;
      }
      if (pa.contact_quality === "hard") bipHard += 1;
    }
  }

  const pct = (num: number, den: number): number | null => (den > 0 ? num / den : null);

  /* Display counts from the pending-inclusive set when provided (live per-pitch updates). */
  let thrownDisplay = thrown;
  let typedTotalDisplay = typedTotal;
  if (mixEvents != null) {
    let mixTyped = 0;
    let mixThrown = 0;
    for (const e of mixEvents) {
      if (!paIds.has(e.pa_id)) continue;
      const nt = normalizeType(e.pitch_type);
      if (nt == null) continue;
      mixTyped += 1;
      if (nt === pitchType) mixThrown += 1;
    }
    thrownDisplay = Math.max(thrown, mixThrown);
    typedTotalDisplay = Math.max(typedTotal, mixTyped);
  }

  return {
    type: pitchType,
    thrown: thrownDisplay,
    typedTotal: typedTotalDisplay,
    mixPct: pct(thrownDisplay, typedTotalDisplay),
    balls,
    calledStrikes,
    swingingStrikes,
    fouls,
    inPlay,
    strikes,
    strikePct: pct(strikes, thrown),
    cswPct: pct(calledStrikes + swingingStrikes, thrown),
    swings,
    swingPct: pct(swings, thrown),
    whiffPct: pct(swingingStrikes, swings),
    foulPct: pct(fouls, thrown),
    contactPct: pct(swings - swingingStrikes, swings),
    firstPitches,
    firstPitchStrikes,
    firstPitchStrikePct: pct(firstPitchStrikes, firstPitches),
    ahead,
    even,
    behind,
    twoStrikePitches,
    twoStrikeSwings,
    twoStrikeWhiffs,
    twoStrikeFouls,
    twoStrikeSwingPct: pct(twoStrikeSwings, twoStrikePitches),
    twoStrikeWhiffPct: pct(twoStrikeWhiffs, twoStrikeSwings),
    twoStrikeContactPct: pct(twoStrikeSwings - twoStrikeWhiffs, twoStrikeSwings),
    twoStrikeFoulPct: pct(twoStrikeFouls, twoStrikePitches),
    putawayKs: endKs,
    putawayPct: pct(endKs, twoStrikePitches),
    paEnded,
    endKs,
    endWalks,
    endHits,
    endOuts,
    endOther,
    abAgainst,
    hitsAgainst,
    baa: pct(hitsAgainst, abAgainst),
    kPct: pct(terminalSo, abAgainst + terminalSo),
    bbPct: pct(terminalBb + terminalIbb + terminalHbp, paEnded),
    slg:
      abAgainst > 0
        ? (terminalSingle + 2 * terminal2b + 3 * terminal3b + 4 * hrAgainst) / abAgainst
        : null,
    hrAgainst,
    bipTagged,
    bipGb,
    bipLd,
    bipFb,
    bipIff,
    bipGbPct: pct(bipGb, bipTagged),
    bipLdPct: pct(bipLd, bipTagged),
    bipFbPct: pct(bipFb, bipTagged),
    bipIffPct: pct(bipIff, bipTagged),
    bipHard,
  };
}
