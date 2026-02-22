import { defensiveAlertsFromEvents, substitutionAlerts } from "@/lib/compute";
import { getGames } from "@/lib/db/queries";
import { getDefensiveEventsByGame } from "@/lib/db/queries";

export default async function CoachAlertsPage() {
  const games = await getGames();
  const recentGameId = games[0]?.id;
  const events = recentGameId
    ? await getDefensiveEventsByGame(recentGameId)
    : [];
  const defensive = defensiveAlertsFromEvents(events);
  const subs = substitutionAlerts(8, 2, []);

  const alerts = [...defensive, ...subs];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">Alerts</h1>
      <p className="text-sm text-[var(--text-muted)]">Defense and late-game subs — short lines only.</p>
      {alerts.length === 0 ? (
        <div className="card-tech rounded-lg border-dashed p-8 text-center">
          <span className="text-4xl opacity-60">✅</span>
          <p className="mt-4 font-medium text-[var(--text)]">No alerts right now</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li key={a.id} className="card-tech flex items-start gap-3 p-4">
              <span className="text-xl opacity-80">{a.icon === "shield" ? "🛡️" : "🔄"}</span>
              <div>
                <p className="font-medium text-[var(--text)]">{a.title}</p>
                <p className="text-sm text-[var(--text-muted)]">{a.line}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
