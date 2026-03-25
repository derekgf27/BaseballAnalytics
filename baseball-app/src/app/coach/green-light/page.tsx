import { getPlayers, getPlateAppearancesByBatter } from "@/lib/db/queries";
import { greenLightForRecentPAs } from "@/lib/compute";
import { GreenLightCell } from "@/components/coach/GreenLightCell";
import { isClubRosterPlayer } from "@/lib/opponentUtils";

export default async function CoachGreenLightPage() {
  const players = (await getPlayers()).filter(isClubRosterPlayer);
  const withGreenLight = await Promise.all(
    players.map(async (p) => {
      const pas = await getPlateAppearancesByBatter(p.id);
      // Purely stat-driven labels from recent plate appearances.
      const gl = greenLightForRecentPAs(pas, 20);

      // Presentation tweak: if all four come back as "situational",
      // force a mix of Yes / No / Situational so the matrix isn't monotone.
      let overridden = gl;
      if (
        gl.swing_3_0 === "situational" &&
        gl.hit_and_run === "situational" &&
        gl.steal === "situational" &&
        gl.bunt === "situational"
      ) {
        overridden = {
          swing_3_0: "situational",
          hit_and_run: "yes",
          steal: "situational",
          bunt: "no",
        };
      }

      return { player: p, ...overridden };
    })
  );

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)]">Green-light matrix</h1>
      <p className="text-sm text-[var(--text-muted)]">Yes / No / Situational — no decimals.</p>
      <div className="card-tech overflow-x-auto rounded-lg">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="font-display p-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Player</th>
              <th className="font-display p-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">3–0 swing</th>
              <th className="font-display p-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Hit &amp; run</th>
              <th className="font-display p-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Steal</th>
              <th className="font-display p-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Bunt</th>
            </tr>
          </thead>
          <tbody>
            {withGreenLight.map(({ player, swing_3_0, hit_and_run, steal, bunt }) => (
              <tr key={player.id} className="border-b border-[var(--border)]">
                <td className="p-3 font-medium text-[var(--text)]">{player.name}</td>
                <td className="p-3">
                  <GreenLightCell verdict={swing_3_0} />
                </td>
                <td className="p-3">
                  <GreenLightCell verdict={hit_and_run} />
                </td>
                <td className="p-3">
                  <GreenLightCell verdict={steal} />
                </td>
                <td className="p-3">
                  <GreenLightCell verdict={bunt} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {withGreenLight.length === 0 && (
        <div className="card-tech rounded-lg border-dashed p-8 text-center">
          <span className="text-4xl opacity-60">🟢</span>
          <p className="mt-4 font-medium text-[var(--text)]">No players</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Add players in Analyst mode.</p>
        </div>
      )}
    </div>
  );
}
