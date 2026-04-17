"use client";

import Link from "next/link";
import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { updateGameLogPlateAppearanceAction } from "@/app/analyst/games/actions";
import { analystGameReviewHref, analystPlayerProfileHref, analystRecordHref } from "@/lib/analystRoutes";
import { isGameFinalized } from "@/lib/gameRecord";
import { formatDateMMDDYYYY } from "@/lib/format";
import { RESULT_ALLOWS_HIT_DIRECTION } from "@/lib/paResultSets";
import { normBaseState } from "@/lib/compute/battingStats";
import type {
  BaseState,
  BattedBallType,
  Bats,
  Game,
  HitDirection,
  PAResult,
  PlateAppearance,
  Player,
} from "@/lib/types";

/** Single letter after name, or null if unknown. */
function batterHandLetter(b: Bats | null | undefined): string | null {
  if (b === "L" || b === "R" || b === "S") return b;
  return null;
}

/** PA `pitcher_hand` first, else roster throws; null if unknown. */
function pitcherHandLetter(pa: PlateAppearance, pitcherPlayer: Player | undefined): string | null {
  if (pa.pitcher_hand === "L" || pa.pitcher_hand === "R") return pa.pitcher_hand;
  const t = pitcherPlayer?.throws;
  if (t === "L" || t === "R") return t;
  return null;
}

const RESULT_SELECT_OPTIONS: { value: PAResult; label: string }[] = [
  { value: "single", label: "1B" },
  { value: "double", label: "2B" },
  { value: "triple", label: "3B" },
  { value: "hr", label: "HR" },
  { value: "out", label: "Out" },
  { value: "so", label: "SO" },
  { value: "so_looking", label: "SO look" },
  { value: "gidp", label: "GIDP" },
  { value: "bb", label: "BB" },
  { value: "ibb", label: "IBB" },
  { value: "hbp", label: "HBP" },
  { value: "sac_fly", label: "SF" },
  { value: "sac_bunt", label: "SH" },
  { value: "sac", label: "Sac" },
  { value: "reached_on_error", label: "ROE" },
  { value: "fielders_choice", label: "FC" },
  { value: "other", label: "Other" },
];

const BBT_OPTIONS: { value: BattedBallType; label: string }[] = [
  { value: "ground_ball", label: "GB" },
  { value: "line_drive", label: "LD" },
  { value: "fly_ball", label: "FB" },
  { value: "infield_fly", label: "IFF" },
];

const BASE_STATE_OPTIONS: { value: BaseState; label: string }[] = [
  { value: "000", label: "Empty" },
  { value: "100", label: "1st" },
  { value: "010", label: "2nd" },
  { value: "001", label: "3rd" },
  { value: "110", label: "1st & 2nd" },
  { value: "101", label: "1st & 3rd" },
  { value: "011", label: "2nd & 3rd" },
  { value: "111", label: "Loaded" },
];

const HIT_DIR_OPTIONS: { value: HitDirection; label: string }[] = [
  { value: "pulled", label: "Pull" },
  { value: "up_the_middle", label: "Middle" },
  { value: "opposite_field", label: "Oppo" },
];

function halfOrder(h: string | null | undefined): number {
  if (h === "top") return 0;
  if (h === "bottom") return 1;
  return 2;
}

function sortPasChronological(pas: PlateAppearance[]): PlateAppearance[] {
  return [...pas].sort((a, b) => {
    if (a.inning !== b.inning) return a.inning - b.inning;
    const ho = halfOrder(a.inning_half) - halfOrder(b.inning_half);
    if (ho !== 0) return ho;
    return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
  });
}

function groupPasByInningHalf(sorted: PlateAppearance[]): { key: string; label: string; items: PlateAppearance[] }[] {
  const map = new Map<string, PlateAppearance[]>();
  const order: string[] = [];
  for (const pa of sorted) {
    const half = pa.inning_half === "bottom" ? "bottom" : "top";
    const key = `${pa.inning}-${half}`;
    if (!map.has(key)) {
      order.push(key);
      map.set(key, []);
    }
    map.get(key)!.push(pa);
  }
  return order.map((key) => {
    const items = map.get(key) ?? [];
    const first = items[0];
    const inn = first?.inning ?? 0;
    const half = first?.inning_half === "bottom" ? "bottom" : "top";
    const label =
      half === "top" ? `Inning ${inn} · Top` : `Inning ${inn} · Bottom`;
    return { key, label, items };
  });
}

const btnPrimary =
  "font-display inline-flex min-h-[44px] items-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--bg-base)] transition hover:opacity-90";
const btnSecondary =
  "font-display inline-flex min-h-[44px] items-center rounded-lg border-2 border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--text)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]";

const selectCell =
  "max-w-[7.5rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-1 py-1 text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none sm:max-w-[9rem]";

const btnRowEdit =
  "shrink-0 rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)] transition hover:border-[var(--accent)]/60 hover:bg-[var(--bg-base)] disabled:cursor-not-allowed disabled:opacity-50";

interface GameLogPageClientProps {
  game: Game;
  initialPas: PlateAppearance[];
  players: Player[];
  canEdit: boolean;
}

export function GameLogPageClient({
  game,
  initialPas,
  players,
  canEdit,
}: GameLogPageClientProps) {
  const router = useRouter();
  const gameId = game.id;
  const gameLabel = `${formatDateMMDDYYYY(game.date)} — ${game.away_team} @ ${game.home_team}`;
  const finalized = isGameFinalized(game);
  const [pas, setPas] = useState<PlateAppearance[]>(initialPas);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of players) m.set(p.id, p.name);
    return m;
  }, [players]);

  const playerById = useMemo(() => {
    const m = new Map<string, Player>();
    for (const p of players) m.set(p.id, p);
    return m;
  }, [players]);

  const sortedPas = useMemo(() => sortPasChronological(pas), [pas]);
  const groups = useMemo(() => groupPasByInningHalf(sortedPas), [sortedPas]);
  const paCount = pas.length;

  const recordHref = analystRecordHref(gameId);
  const reviewHref = analystGameReviewHref(gameId);

  const showToast = useCallback((type: "ok" | "err", text: string) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 5000);
  }, []);

  const applyPatch = useCallback(
    async (
      paId: string,
      patch: {
        result?: PAResult;
        batted_ball_type?: BattedBallType | null;
        base_state?: BaseState;
        hit_direction?: HitDirection | null;
      }
    ) => {
      if (!canEdit) return;
      setSavingId(paId);
      try {
        const res = await updateGameLogPlateAppearanceAction(gameId, paId, patch);
        if (!res.ok) {
          showToast("err", res.error ?? "Could not update");
          return;
        }
        if (res.pa) {
          setPas((prev) => prev.map((p) => (p.id === paId ? { ...p, ...res.pa } : p)));
        } else {
          router.refresh();
        }
        showToast("ok", "Saved");
      } finally {
        setSavingId(null);
      }
    },
    [canEdit, gameId, router, showToast]
  );

  return (
    <div className="space-y-6 pb-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)]">
          Game log
        </h1>
        <p className="text-sm text-[var(--text-muted)]">{gameLabel}</p>
        <p className="text-xs text-[var(--text-muted)]">
          {finalized ? (
            <>
              This game is <strong className="font-medium text-[var(--text)]">finalized</strong>. Use{" "}
              <strong className="font-medium text-[var(--text)]">Edit</strong> on a row to fix result, bases, batted
              ball, and spray — the full PA form stays closed.
            </>
          ) : (
            <>
              Use <strong className="font-medium text-[var(--text)]">Record</strong> for new PAs. Use{" "}
              <strong className="font-medium text-[var(--text)]">Edit</strong> on a row to change{" "}
              <strong className="font-medium text-[var(--text)]">result</strong>,{" "}
              <strong className="font-medium text-[var(--text)]">runners on</strong>,{" "}
              <strong className="font-medium text-[var(--text)]">batted ball type</strong>, and{" "}
              <strong className="font-medium text-[var(--text)]">hit direction</strong> without opening Record.
            </>
          )}
        </p>
      </header>

      <nav
        className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-4"
        aria-label="Game workflow"
      >
        {finalized ? (
          <Link href={reviewHref} className={btnPrimary}>
            Review
          </Link>
        ) : (
          <>
            <Link href={recordHref} className={btnPrimary}>
              Continue recording
            </Link>
            <Link href={reviewHref} className={btnSecondary}>
              Review
            </Link>
          </>
        )}
        <Link
          href="/analyst/games"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--text)]"
        >
          All games
        </Link>
      </nav>

      {toast && (
        <div
          role="status"
          className={`rounded-lg border px-3 py-2 text-sm ${
            toast.type === "ok"
              ? "border-[var(--success)] bg-[var(--success-dim)] text-[var(--success)]"
              : "border-[var(--danger)] bg-[var(--danger-dim)] text-[var(--danger)]"
          }`}
        >
          {toast.text}
        </div>
      )}

      {!canEdit && paCount > 0 && (
        <p className="text-xs text-[var(--text-muted)]">
          Connect Supabase to edit outcomes from this log. You can still review PAs read-only.
        </p>
      )}

      {paCount === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-card)] px-4 py-8 text-center">
          <p className="font-medium text-[var(--text)]">No plate appearances yet</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {finalized ? (
              <>
                Game is finalized — use <span className="text-[var(--text)]">Review</span> for the box score, or pick
                another game.
              </>
            ) : (
              <>
                Open <span className="text-[var(--text)]">Record</span> to log PAs, or choose another game.
              </>
            )}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {finalized ? (
              <Link href={reviewHref} className={btnPrimary}>
                Review
              </Link>
            ) : (
              <Link href={recordHref} className={btnPrimary}>
                Record
              </Link>
            )}
            <Link href="/analyst/games" className={btnSecondary}>
              Pick a game
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text)]">{paCount}</span> plate appearance
            {paCount === 1 ? "" : "s"} — grouped by inning.{" "}
            {finalized ? (
              <span className="text-[var(--text-muted)]">Recording is closed — this game is finalized.</span>
            ) : (
              <>
                <Link href={recordHref} className="font-medium text-[var(--accent)] hover:underline">
                  Record
                </Link>{" "}
                to add more.
              </>
            )}
          </p>

          {groups.map((g) => (
            <section key={g.key} className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
              <h2 className="border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 font-display text-xs font-semibold uppercase tracking-wider text-white">
                {g.label}{" "}
                <span className="font-normal normal-case text-[var(--text-muted)]">
                  ({g.items.length} PA{g.items.length === 1 ? "" : "s"})
                </span>
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]/80">
                      <th className="px-2 py-2 font-display font-semibold uppercase tracking-wider text-white">
                        Batter
                      </th>
                      <th className="px-2 py-2 font-display font-semibold uppercase tracking-wider text-white">
                        Pitcher
                      </th>
                      <th className="px-2 py-2 font-display font-semibold uppercase tracking-wider text-white">
                        Count
                      </th>
                      <th className="px-2 py-2 font-display font-semibold uppercase tracking-wider text-white">
                        Pitches
                      </th>
                      <th className="px-2 py-2 font-display font-semibold uppercase tracking-wider text-white">
                        Outs
                      </th>
                      <th className="px-2 py-2 font-display font-semibold uppercase tracking-wider text-white">
                        Runners
                      </th>
                      <th className="px-2 py-2 font-display font-semibold uppercase tracking-wider text-white">
                        Result
                      </th>
                      <th className="px-2 py-2 font-display font-semibold uppercase tracking-wider text-white">
                        BIP
                      </th>
                      <th className="px-2 py-2 font-display font-semibold uppercase tracking-wider text-white">
                        Dir
                      </th>
                      <th className="px-2 py-2 font-display font-semibold uppercase tracking-wider text-white">
                        RBI
                      </th>
                      {canEdit ? (
                        <th
                          scope="col"
                          className="w-px whitespace-nowrap px-2 py-2 font-display text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
                        >
                          <span className="sr-only">Row actions</span>
                          <span aria-hidden="true"> </span>
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((pa) => {
                      const batterName = nameById.get(pa.batter_id) ?? pa.batter_id.slice(0, 8);
                      const batterPl = playerById.get(pa.batter_id);
                      const pitcherName = pa.pitcher_id
                        ? (nameById.get(pa.pitcher_id) ?? "—")
                        : "—";
                      const pitcherPl = pa.pitcher_id ? playerById.get(pa.pitcher_id) : undefined;
                      const pitchesSeen =
                        pa.pitches_seen != null && !Number.isNaN(Number(pa.pitches_seen))
                          ? String(pa.pitches_seen)
                          : "—";
                      const allowsBip = RESULT_ALLOWS_HIT_DIRECTION.has(pa.result);
                      const busy = savingId === pa.id;
                      const rowEditing = canEdit && editingId === pa.id;
                      const basesNorm = normBaseState(pa.base_state);
                      const basesLabel =
                        BASE_STATE_OPTIONS.find((o) => o.value === basesNorm)?.label ?? basesNorm;
                      const batLtr = batterHandLetter(batterPl?.bats);
                      const pitLtr = pa.pitcher_id ? pitcherHandLetter(pa, pitcherPl) : null;

                      return (
                        <tr key={pa.id} className="border-b border-[var(--border)] last:border-0">
                          <td className="px-2 py-2 font-medium text-[var(--text)]">
                            <Link
                              href={analystPlayerProfileHref(pa.batter_id)}
                              className="text-[var(--accent)] hover:underline"
                            >
                              {batterName}
                              {batLtr != null ? (
                                <span className="ml-2 font-normal text-white">{batLtr}</span>
                              ) : null}
                            </Link>
                          </td>
                          <td className="max-w-[8rem] truncate px-2 py-2 text-[var(--text-muted)]">
                            {pa.pitcher_id ? (
                              <Link
                                href={analystPlayerProfileHref(pa.pitcher_id)}
                                className="text-[var(--accent)] hover:underline"
                              >
                                {pitcherName}
                                {pitLtr != null ? (
                                  <span className="ml-2 text-white">{pitLtr}</span>
                                ) : null}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 tabular-nums text-[var(--text)]">
                            {pa.count_balls}-{pa.count_strikes}
                          </td>
                          <td className="px-2 py-2 tabular-nums text-[var(--text)]">{pitchesSeen}</td>
                          <td className="px-2 py-2 tabular-nums text-[var(--text)]">{pa.outs}</td>
                          <td className="px-2 py-2">
                            {rowEditing ? (
                              <select
                                className={selectCell}
                                disabled={busy}
                                value={basesNorm}
                                onChange={(e) => {
                                  void applyPatch(pa.id, { base_state: e.target.value as BaseState });
                                }}
                                aria-label={`Runners on base for ${batterName}`}
                              >
                                {BASE_STATE_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-[var(--text-muted)]" title={basesNorm}>
                                {basesLabel}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            {rowEditing ? (
                              <select
                                className={selectCell}
                                disabled={busy}
                                value={pa.result}
                                onChange={(e) => {
                                  const next = e.target.value as PAResult;
                                  void applyPatch(pa.id, { result: next });
                                }}
                                aria-label={`Result for ${batterName}`}
                              >
                                {RESULT_SELECT_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-[var(--text)]">
                                {RESULT_SELECT_OPTIONS.find((o) => o.value === pa.result)?.label ?? pa.result}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            {allowsBip ? (
                              rowEditing ? (
                                <select
                                  className={selectCell}
                                  disabled={busy}
                                  value={pa.batted_ball_type ?? ""}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const next: BattedBallType | null =
                                      raw === "" ? null : (raw as BattedBallType);
                                    void applyPatch(pa.id, { batted_ball_type: next });
                                  }}
                                  aria-label={`Batted ball type for ${batterName}`}
                                >
                                  <option value="">—</option>
                                  {BBT_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-[var(--text-muted)]">
                                  {pa.batted_ball_type
                                    ? BBT_OPTIONS.find((o) => o.value === pa.batted_ball_type)?.label ?? "—"
                                    : "—"}
                                </span>
                              )
                            ) : (
                              <span className="text-[var(--text-faint)]">—</span>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            {allowsBip ? (
                              rowEditing ? (
                                <select
                                  className={selectCell}
                                  disabled={busy}
                                  value={pa.hit_direction ?? ""}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const next: HitDirection | null =
                                      raw === "" ? null : (raw as HitDirection);
                                    void applyPatch(pa.id, { hit_direction: next });
                                  }}
                                  aria-label={`Hit direction for ${batterName}`}
                                >
                                  <option value="">—</option>
                                  {HIT_DIR_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-[var(--text-muted)]">
                                  {pa.hit_direction
                                    ? HIT_DIR_OPTIONS.find((o) => o.value === pa.hit_direction)?.label ??
                                      "—"
                                    : "—"}
                                </span>
                              )
                            ) : (
                              <span className="text-[var(--text-faint)]">—</span>
                            )}
                          </td>
                          <td className="px-2 py-2 tabular-nums text-[var(--text)]">{pa.rbi}</td>
                          {canEdit ? (
                            <td className="whitespace-nowrap px-2 py-2 text-right align-middle">
                              {rowEditing ? (
                                <button
                                  type="button"
                                  className={btnRowEdit}
                                  disabled={busy}
                                  onClick={() => setEditingId(null)}
                                  aria-label={`Done editing ${batterName}`}
                                >
                                  Done
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className={btnRowEdit}
                                  disabled={savingId != null}
                                  onClick={() => setEditingId(pa.id)}
                                  aria-label={`Edit plate appearance for ${batterName}`}
                                >
                                  Edit
                                </button>
                              )}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

    </div>
  );
}
