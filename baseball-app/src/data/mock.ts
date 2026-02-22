/**
 * Mock data for coach decision-first UI.
 * Design intent: One source of truth for Today, lineup, players, and game review.
 * No backend — static JSON-shaped data for demo.
 */

export type Confidence = "high" | "medium" | "low" | "none";

export type PlayerTagType = "POWER" | "CONTACT" | "SPEED" | "EYE" | "CLUTCH";

export type TrendType = "hot" | "cold" | "neutral";

export interface GameInfo {
  id: string;
  opponent: string;
  venue: string;
  venueType: "home" | "away";
  startTime: string;
  weather: string;
  weatherShort: string;
}

export interface LineupSlot {
  order: number;
  playerId: string;
  playerName: string;
  position: string;
  confidence: Confidence;
  tags: PlayerTagType[];
}

export interface TodayAlert {
  id: string;
  type: "hot" | "cold" | "risk";
  title: string;
  line: string;
}

export interface MatchupBullet {
  id: string;
  text: string;
  kind: "advantage" | "neutral" | "risk";
}

export interface TodayData {
  game: GameInfo;
  recommendedLineup: LineupSlot[];
  alerts: TodayAlert[];
  matchupSummary: MatchupBullet[];
}

export interface PlayerCard {
  id: string;
  name: string;
  position: string;
  positions: string[];
  bats: string;
  throws: string;
  trend: TrendType;
  strengths: string[];
  weaknesses: string[];
  situationalValue: {
    risp: Confidence;
    lateInnings: Confidence;
    defense: Confidence;
  };
  tags: PlayerTagType[];
  note?: string;
}

export interface LineupImpact {
  projectedImpact: "up" | "down" | "neutral";
  platoonAdvantage: "gained" | "lost" | "unchanged";
  defensiveRisk: "up" | "down" | "unchanged";
}

export interface GameReviewInning {
  inning: number;
  topBottom: "top" | "bottom";
  summary: string;
  keyDecisions: { text: string; outcome: "good" | "missed" | "neutral" }[];
  runs: number;
}

export interface GameReviewData {
  gameId: string;
  opponent: string;
  date: string;
  innings: GameReviewInning[];
}

// ——— Static mock: Today ———
export const mockToday: TodayData = {
  game: {
    id: "g1",
    opponent: "River Hawks",
    venue: "Fenway South",
    venueType: "home",
    startTime: "7:05 PM",
    weather: "Partly cloudy, 72°F",
    weatherShort: "72° · Partly cloudy",
  },
  recommendedLineup: [
    { order: 1, playerId: "p1", playerName: "Jordan Reyes", position: "CF", confidence: "high", tags: ["SPEED", "CONTACT"] },
    { order: 2, playerId: "p2", playerName: "Marcus Webb", position: "2B", confidence: "high", tags: ["CONTACT", "EYE"] },
    { order: 3, playerId: "p3", playerName: "Alex Cruz", position: "SS", confidence: "high", tags: ["POWER", "CONTACT"] },
    { order: 4, playerId: "p4", playerName: "Sam Davis", position: "1B", confidence: "medium", tags: ["POWER"] },
    { order: 5, playerId: "p5", playerName: "Jamie Park", position: "RF", confidence: "medium", tags: ["POWER", "CLUTCH"] },
    { order: 6, playerId: "p6", playerName: "Taylor Kim", position: "3B", confidence: "medium", tags: ["CONTACT"] },
    { order: 7, playerId: "p7", playerName: "Casey Morgan", position: "LF", confidence: "low", tags: ["SPEED"] },
    { order: 8, playerId: "p8", playerName: "Riley Chen", position: "C", confidence: "high", tags: ["CONTACT", "EYE"] },
    { order: 9, playerId: "p9", playerName: "Drew Foster", position: "DH", confidence: "medium", tags: ["POWER"] },
  ],
  alerts: [
    { id: "a1", type: "hot", title: "Hot", line: "Jordan Reyes — 8-for-18 last 5" },
    { id: "a2", type: "cold", title: "Cold", line: "Casey Morgan — 2-for-22, consider spot" },
    { id: "a3", type: "risk", title: "Risk", line: "Lefty on mound — Davis & Park platoon edge" },
  ],
  matchupSummary: [
    { id: "m1", text: "Their starter: heavy slider. Our righties in the heart of the order.", kind: "advantage" },
    { id: "m2", text: "Closer has been used 3 days in a row.", kind: "advantage" },
    { id: "m3", text: "Watch Morgan in LF vs their 4-hole pull hitter.", kind: "risk" },
  ],
};

// ——— Mock players (for cards and lineup builder) ———
export const mockPlayers: PlayerCard[] = [
  {
    id: "p1",
    name: "Jordan Reyes",
    position: "CF",
    positions: ["CF", "LF"],
    bats: "L",
    throws: "L",
    trend: "hot",
    strengths: ["Speed", "Range in CF", "Bunt game"],
    weaknesses: ["Off-speed away"],
    situationalValue: { risp: "high", lateInnings: "high", defense: "high" },
    tags: ["SPEED", "CONTACT"],
    note: "Leadoff vs RHP preferred.",
  },
  {
    id: "p2",
    name: "Marcus Webb",
    position: "2B",
    positions: ["2B", "SS"],
    bats: "R",
    throws: "R",
    trend: "neutral",
    strengths: ["Contact", "Plate discipline", "Turn double play"],
    weaknesses: ["Power to pull"],
    situationalValue: { risp: "high", lateInnings: "medium", defense: "high" },
    tags: ["CONTACT", "EYE"],
  },
  {
    id: "p3",
    name: "Alex Cruz",
    position: "SS",
    positions: ["SS", "3B"],
    bats: "R",
    throws: "R",
    trend: "hot",
    strengths: ["Power", "Arm strength", "Clutch hits"],
    weaknesses: ["Chase up"],
    situationalValue: { risp: "high", lateInnings: "high", defense: "high" },
    tags: ["POWER", "CONTACT"],
  },
  {
    id: "p4",
    name: "Sam Davis",
    position: "1B",
    positions: ["1B", "DH"],
    bats: "L",
    throws: "L",
    trend: "neutral",
    strengths: ["Power vs RHP", "Stretch at first"],
    weaknesses: ["Vs LHP", "Range"],
    situationalValue: { risp: "medium", lateInnings: "medium", defense: "low" },
    tags: ["POWER"],
  },
  {
    id: "p5",
    name: "Jamie Park",
    position: "RF",
    positions: ["RF", "LF"],
    bats: "L",
    throws: "L",
    trend: "neutral",
    strengths: ["Power", "RISP", "Arm"],
    weaknesses: ["Speed"],
    situationalValue: { risp: "high", lateInnings: "high", defense: "medium" },
    tags: ["POWER", "CLUTCH"],
  },
  {
    id: "p6",
    name: "Taylor Kim",
    position: "3B",
    positions: ["3B", "2B"],
    bats: "R",
    throws: "R",
    trend: "cold",
    strengths: ["Contact", "Glove at third"],
    weaknesses: ["Power", "Vs hard in"],
    situationalValue: { risp: "medium", lateInnings: "low", defense: "high" },
    tags: ["CONTACT"],
  },
  {
    id: "p7",
    name: "Casey Morgan",
    position: "LF",
    positions: ["LF", "CF"],
    bats: "R",
    throws: "R",
    trend: "cold",
    strengths: ["Speed", "Bunt"],
    weaknesses: ["Vs breaking ball", "Recent slump"],
    situationalValue: { risp: "low", lateInnings: "low", defense: "medium" },
    tags: ["SPEED"],
  },
  {
    id: "p8",
    name: "Riley Chen",
    position: "C",
    positions: ["C"],
    bats: "S",
    throws: "R",
    trend: "neutral",
    strengths: ["Framing", "Contact both sides", "Game call"],
    weaknesses: ["Power"],
    situationalValue: { risp: "high", lateInnings: "medium", defense: "high" },
    tags: ["CONTACT", "EYE"],
  },
  {
    id: "p9",
    name: "Drew Foster",
    position: "DH",
    positions: ["DH", "1B"],
    bats: "R",
    throws: "R",
    trend: "neutral",
    strengths: ["Power", "Vs LHP"],
    weaknesses: ["Defense", "Vs RHP"],
    situationalValue: { risp: "medium", lateInnings: "medium", defense: "none" },
    tags: ["POWER"],
  },
];

// ——— Mock game review (analyst-facing) ———
export const mockGameReview: GameReviewData = {
  gameId: "g1",
  opponent: "River Hawks",
  date: "Feb 6, 2025",
  innings: [
    {
      inning: 1,
      topBottom: "top",
      summary: "1-2-3. Reyes caught a drive in CF.",
      keyDecisions: [{ text: "Reyes in CF", outcome: "good" }],
      runs: 0,
    },
    {
      inning: 1,
      topBottom: "bottom",
      summary: "Cruz 2-run HR. Davis lineout, Park K.",
      keyDecisions: [
        { text: "Cruz 3-hole", outcome: "good" },
        { text: "Park 5th vs RHP", outcome: "neutral" },
      ],
      runs: 2,
    },
    {
      inning: 2,
      topBottom: "top",
      summary: "Single, DP, groundout.",
      keyDecisions: [{ text: "Webb–Cruz DP", outcome: "good" }],
      runs: 0,
    },
    {
      inning: 2,
      topBottom: "bottom",
      summary: "Morgan K, Chen single, Foster GIDP.",
      keyDecisions: [{ text: "Morgan 7th", outcome: "missed" }],
      runs: 0,
    },
    {
      inning: 3,
      topBottom: "top",
      summary: "Solo HR. Two flyouts, K.",
      keyDecisions: [],
      runs: 1,
    },
    {
      inning: 3,
      topBottom: "bottom",
      summary: "Reyes walk, Webb single, Cruz F7, Davis sac fly.",
      keyDecisions: [{ text: "Small ball 3rd", outcome: "good" }],
      runs: 1,
    },
  ],
};
