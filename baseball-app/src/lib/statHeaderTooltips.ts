/**
 * Full stat names for table header `title` attributes (hover tooltips).
 * Keep in sync with batting stats columns across analyst stats / profiles.
 */

import { REGULATION_INNINGS } from "@/lib/leagueConfig";

const R = REGULATION_INNINGS;

export const BATTING_STAT_HEADER_TOOLTIPS = {
  rank: "Rank",
  player: "Player name",
  pos: "Position",
  bats: "Batting Handedness",
  gp: "Games played",
  gs: "Games started",
  pa: "Plate appearances",
  ab: "At-bats",
  h: "Hits",
  double: "Doubles",
  triple: "Triples",
  hr: "Home runs",
  rbi: "Runs batted in",
  r: "Runs scored",
  sb: "Stolen bases",
  cs: "Caught stealing",
  sbPct: "Stolen base percentage",
  bb: "Walks",
  ibb: "Intentional walks",
  hbp: "Hit by pitch",
  so: "Strikeouts",
  gidp: "Ground into double play",
  fieldersChoice: "Fielder's choice",
  pPa: "Pitches per plate appearance",
  kPct: "Strikeout percentage",
  bbPct: "Walk percentage",
  avg: "Batting average",
  obp: "On-base percentage",
  slg: "Slugging percentage",
  ops: "On-base plus slugging",
  opsPlus: "On-Base Plus Slugging Plus",
  woba: "Weighted on-base average",
  split: "Split (situation)",
} as const;

export const PITCHING_STAT_HEADER_TOOLTIPS = {
  rank: "Rank",
  player: "Player name",
  throws: "Throwing hand",
  g: "Games",
  gs: "Games started",
  ip: "Innings pitched",
  h: "Hits allowed",
  r: "Runs allowed",
  era: `Earned run average (earned runs per ${R} innings)`,
  er: "Earned runs",
  hr: "Home runs allowed",
  so: "Strikeouts",
  bb: "Walks",
  hbp: "Hit by pitch",
  fip: `Fielding independent pitching (scaled to ${R}-inning ERA)`,
  whip: "Walks plus hits per inning pitched",
  k7: `Strikeouts per ${R} innings`,
  bb7: `Walks per ${R} innings`,
  h7: `Hits allowed per ${R} innings`,
  hr7: `Home runs allowed per ${R} innings`,
  kPctPitch: "Strikeout rate",
  bbPctPitch: "Walk rate",
  strikePctPitch: "Strike rate",
  fpsPctPitch:
    "First-pitch strike rate ",
  pPaPitch: "Pitches per plate appearance",
  vsLHB: "Batters who bat left-handed only ",
  vsRHB: "Batters who bat right-handed only ",
} as const;
