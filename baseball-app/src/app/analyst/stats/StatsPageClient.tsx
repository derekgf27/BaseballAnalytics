"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { clearAllStatsAction } from "@/app/analyst/games/actions";
import { BattingStatsSheet } from "@/components/analyst/BattingStatsSheet";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { PitchingStatsSheet } from "@/components/analyst/PitchingStatsSheet";
import { computeBattingStatsWithSplitsFromPas } from "@/lib/compute/battingStatsWithSplitsFromPas";
import { computePitchingStatsWithSplitsForRoster } from "@/lib/compute/pitchingStats";
import { opponentNameKey, opponentTeamName, uniqueOpponentNames } from "@/lib/opponentUtils";
import type {
  BattingStatsWithSplits,
  Bats,
  ClubBattingMatchupPayload,
  ClubPitchingMatchupPayload,
  PitchingStatsWithSplits,
  Player,
} from "@/lib/types";

type StatsTab = "batting" | "pitching";

interface StatsPageClientProps {
  initialBatters?: Player[];
  initialPitchers?: Player[];
  /** @deprecated Prefer `initialBatters` — kept so older RSC payloads that only pass this still work. */
  initialPlayers?: Player[];
  initialBattingStatsWithSplits?: Record<string, BattingStatsWithSplits>;
  initialPitchingStatsWithSplits?: Record<string, PitchingStatsWithSplits>;
  battingMatchupPayload?: ClubBattingMatchupPayload;
  pitchingMatchupPayload?: ClubPitchingMatchupPayload;
  playerIdToName?: Record<string, string>;
}

export function StatsPageClient({
  initialBatters,
  initialPitchers,
  initialPlayers,
  initialBattingStatsWithSplits = {},
  initialPitchingStatsWithSplits = {},
  battingMatchupPayload,
  pitchingMatchupPayload,
  playerIdToName = {},
}: StatsPageClientProps) {
  const batters = initialBatters ?? initialPlayers ?? [];
  const batterIds = useMemo(() => batters.map((p) => p.id), [batters]);
  const pitchers = initialPitchers ?? [];
  const pitcherIds = useMemo(() => pitchers.map((p) => p.id), [pitchers]);
  const router = useRouter();
  const [tab, setTab] = useState<StatsTab>("batting");
  const [matchupOpponentKey, setMatchupOpponentKey] = useState("");
  const [matchupPitcherId, setMatchupPitcherId] = useState("");
  const [pitchMatchupOpponentKey, setPitchMatchupOpponentKey] = useState("");
  const [pitchMatchupBatterId, setPitchMatchupBatterId] = useState("");
  const [clearingAll, setClearingAll] = useState(false);
  const [clearStatsConfirmOpen, setClearStatsConfirmOpen] = useState(false);
  const [clearMessage, setClearMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const matchupOpponents = useMemo(() => {
    if (!battingMatchupPayload?.games?.length) return [];
    return uniqueOpponentNames(battingMatchupPayload.games).map((label) => ({
      key: opponentNameKey(label),
      label,
    }));
  }, [battingMatchupPayload?.games]);

  const matchupPitchersByOpponent = useMemo(() => {
    if (!battingMatchupPayload) return {} as Record<string, { id: string; name: string }[]>;
    const { pas, games } = battingMatchupPayload;
    const gameIdsByOpponent = new Map<string, Set<string>>();
    for (const g of games) {
      const key = opponentNameKey(opponentTeamName(g));
      if (!gameIdsByOpponent.has(key)) gameIdsByOpponent.set(key, new Set());
      gameIdsByOpponent.get(key)!.add(g.id);
    }
    const out: Record<string, { id: string; name: string }[]> = {};
    for (const [oppKey, gids] of gameIdsByOpponent) {
      const seen = new Set<string>();
      const rows: { id: string; name: string }[] = [];
      for (const pa of pas) {
        if (!pa.pitcher_id || !gids.has(pa.game_id)) continue;
        if (seen.has(pa.pitcher_id)) continue;
        seen.add(pa.pitcher_id);
        rows.push({
          id: pa.pitcher_id,
          name: playerIdToName[pa.pitcher_id]?.trim() || "Unknown pitcher",
        });
      }
      rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      out[oppKey] = rows;
    }
    return out;
  }, [battingMatchupPayload, playerIdToName]);

  const startedGamesByPlayer = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const raw = battingMatchupPayload?.startedGameIdsByPlayer ?? {};
    for (const [pid, ids] of Object.entries(raw)) {
      m.set(pid, new Set(ids as string[]));
    }
    return m;
  }, [battingMatchupPayload?.startedGameIdsByPlayer]);

  const filteredMatchupPas = useMemo(() => {
    if (!battingMatchupPayload || !matchupOpponentKey) return null;
    const gameIdSet = new Set(
      battingMatchupPayload.games
        .filter((g) => opponentNameKey(opponentTeamName(g)) === matchupOpponentKey)
        .map((g) => g.id)
    );
    let list = battingMatchupPayload.pas.filter((pa) => gameIdSet.has(pa.game_id));
    if (matchupPitcherId) list = list.filter((pa) => pa.pitcher_id === matchupPitcherId);
    return list;
  }, [battingMatchupPayload, matchupOpponentKey, matchupPitcherId]);

  const displayBattingStatsWithSplits = useMemo(() => {
    if (!filteredMatchupPas || !battingMatchupPayload) return initialBattingStatsWithSplits;
    return computeBattingStatsWithSplitsFromPas(
      batterIds,
      filteredMatchupPas,
      battingMatchupPayload.baserunningByPlayerId,
      startedGamesByPlayer
    );
  }, [filteredMatchupPas, battingMatchupPayload, batterIds, startedGamesByPlayer, initialBattingStatsWithSplits]);

  const pitchMatchupOpponents = useMemo(() => {
    if (!pitchingMatchupPayload?.games?.length) return [];
    return uniqueOpponentNames(pitchingMatchupPayload.games).map((label) => ({
      key: opponentNameKey(label),
      label,
    }));
  }, [pitchingMatchupPayload?.games]);

  const pitchMatchupBattersByOpponent = useMemo(() => {
    if (!pitchingMatchupPayload) return {} as Record<string, { id: string; name: string }[]>;
    const { pas, games } = pitchingMatchupPayload;
    const gameIdsByOpponent = new Map<string, Set<string>>();
    for (const g of games) {
      const key = opponentNameKey(opponentTeamName(g));
      if (!gameIdsByOpponent.has(key)) gameIdsByOpponent.set(key, new Set());
      gameIdsByOpponent.get(key)!.add(g.id);
    }
    const out: Record<string, { id: string; name: string }[]> = {};
    for (const [oppKey, gids] of gameIdsByOpponent) {
      const seen = new Set<string>();
      const rows: { id: string; name: string }[] = [];
      for (const pa of pas) {
        if (!pa.batter_id || !gids.has(pa.game_id)) continue;
        if (seen.has(pa.batter_id)) continue;
        seen.add(pa.batter_id);
        rows.push({
          id: pa.batter_id,
          name: playerIdToName[pa.batter_id]?.trim() || "Unknown batter",
        });
      }
      rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      out[oppKey] = rows;
    }
    return out;
  }, [pitchingMatchupPayload, playerIdToName]);

  const pitchStarterMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const raw = pitchingMatchupPayload?.starterGameIdsByPlayer ?? {};
    for (const [pid, ids] of Object.entries(raw)) {
      m.set(pid, new Set(ids as string[]));
    }
    return m;
  }, [pitchingMatchupPayload?.starterGameIdsByPlayer]);

  const pitchBatterBatsMap = useMemo(() => {
    const m = new Map<string, Bats | null | undefined>();
    const raw = pitchingMatchupPayload?.batterBatsById ?? {};
    for (const [id, bats] of Object.entries(raw)) {
      const ch = bats?.trim().toUpperCase()[0];
      if (ch === "L" || ch === "R" || ch === "S") m.set(id, ch as Bats);
      else m.set(id, null);
    }
    return m;
  }, [pitchingMatchupPayload?.batterBatsById]);

  const filteredPitchingMatchupPas = useMemo(() => {
    if (!pitchingMatchupPayload || !pitchMatchupOpponentKey) return null;
    const gameIdSet = new Set(
      pitchingMatchupPayload.games
        .filter((g) => opponentNameKey(opponentTeamName(g)) === pitchMatchupOpponentKey)
        .map((g) => g.id)
    );
    let list = pitchingMatchupPayload.pas.filter((pa) => gameIdSet.has(pa.game_id));
    if (pitchMatchupBatterId) list = list.filter((pa) => pa.batter_id === pitchMatchupBatterId);
    return list;
  }, [pitchingMatchupPayload, pitchMatchupOpponentKey, pitchMatchupBatterId]);

  const displayPitchingStatsWithSplits = useMemo(() => {
    if (!filteredPitchingMatchupPas || !pitchingMatchupPayload) return initialPitchingStatsWithSplits;
    return computePitchingStatsWithSplitsForRoster(
      pitcherIds,
      filteredPitchingMatchupPas,
      pitchStarterMap,
      pitchBatterBatsMap
    );
  }, [
    filteredPitchingMatchupPas,
    pitchingMatchupPayload,
    pitcherIds,
    pitchStarterMap,
    pitchBatterBatsMap,
    initialPitchingStatsWithSplits,
  ]);

  const statsTabToggle = (
    <div
      className="inline-flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-1"
      role="group"
      aria-label="Batting or pitching stats"
    >
      <button
        type="button"
        onClick={() => setTab("batting")}
        className={`rounded-md px-4 py-2 text-sm font-medium transition ${
          tab === "batting"
            ? "bg-[var(--accent)] text-[var(--accent-fg)]"
            : "text-[var(--text-muted)] hover:text-[var(--text)]"
        }`}
      >
        Batters
      </button>
      <button
        type="button"
        onClick={() => setTab("pitching")}
        className={`rounded-md px-4 py-2 text-sm font-medium transition ${
          tab === "pitching"
            ? "bg-[var(--accent)] text-[var(--accent-fg)]"
            : "text-[var(--text-muted)] hover:text-[var(--text)]"
        }`}
      >
        Pitchers
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)]">Stats</h1>
        
      </div>

      {tab === "batting" && (
        <BattingStatsSheet
          players={batters}
          battingStatsWithSplits={displayBattingStatsWithSplits}
          heading="Batting"
          subheading=""
          toolbarEnd={statsTabToggle}
          splitDisabled={!!matchupPitcherId}
          matchupToolbar={
            battingMatchupPayload && matchupOpponents.length > 0
              ? {
                  opponents: matchupOpponents,
                  pitchersByOpponent: matchupPitchersByOpponent,
                  opponentKey: matchupOpponentKey,
                  pitcherId: matchupPitcherId,
                  onOpponentChange: setMatchupOpponentKey,
                  onPitcherChange: setMatchupPitcherId,
                }
              : undefined
          }
        />
      )}

      {tab === "pitching" && (
        <PitchingStatsSheet
          players={pitchers}
          pitchingStatsWithSplits={displayPitchingStatsWithSplits}
          heading="Pitching"
          toolbarEnd={statsTabToggle}
          splitDisabled={!!pitchMatchupBatterId}
          matchupToolbar={
            pitchingMatchupPayload && pitchMatchupOpponents.length > 0
              ? {
                  opponents: pitchMatchupOpponents,
                  battersByOpponent: pitchMatchupBattersByOpponent,
                  opponentKey: pitchMatchupOpponentKey,
                  batterId: pitchMatchupBatterId,
                  onOpponentChange: setPitchMatchupOpponentKey,
                  onBatterChange: setPitchMatchupBatterId,
                }
              : undefined
          }
        />
      )}

      <div className="rounded-lg border p-4" style={{ borderColor: "var(--danger)" }}>
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--danger)" }}>
          Clear all stats
        </h3>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Permanently delete every plate appearance and baserunning event in the database. Batting stats and trends will
          reset.
        </p>
        <button
          type="button"
          disabled={clearingAll}
          onClick={() => setClearStatsConfirmOpen(true)}
          className="mt-3 rounded-lg border px-3 py-2 text-sm font-medium transition disabled:opacity-50"
          style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
        >
          {clearingAll ? "Clearing…" : "Clear all stats"}
        </button>
        {clearMessage && (
          <p className={`mt-3 text-sm ${clearMessage.type === "ok" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
            {clearMessage.text}
          </p>
        )}
      </div>

      <ConfirmDeleteDialog
        open={clearStatsConfirmOpen}
        onClose={() => !clearingAll && setClearStatsConfirmOpen(false)}
        title="Clear all stats?"
        description="This permanently deletes every plate appearance and baserunning event in the database for all games. Batting and pitching stats will reset. This cannot be undone."
        confirmLabel="Clear all stats"
        pendingLabel="Clearing…"
        pending={clearingAll}
        onConfirm={async () => {
          setClearingAll(true);
          setClearMessage(null);
          const result = await clearAllStatsAction();
          setClearingAll(false);
          setClearStatsConfirmOpen(false);
          if (result.ok) {
            setClearMessage({
              type: "ok",
              text: result.count > 0 ? `Cleared ${result.count} plate appearance(s).` : "No PAs to clear.",
            });
            router.refresh();
          } else {
            setClearMessage({ type: "err", text: result.error ?? "Failed to clear stats." });
          }
        }}
      />
    </div>
  );
}
