import Link from "next/link";

const TILES = [
  {
    href: "/analyst/games",
    icon: "📝",
    title: "Log game",
    description: "Select a game and log plate appearances and defensive events.",
  },
  {
    href: "/analyst/players",
    icon: "👤",
    title: "Players",
    description: "Profiles, internal ratings, and overrides.",
  },
  {
    href: "/analyst/charts",
    icon: "📈",
    title: "Charts",
    description: "Contact quality, chase tendencies, late-game trends.",
  },
] as const;

export default function AnalystDashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Full access to data, logging, and charts.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map(({ href, icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="card-tech card-hover flex flex-col p-5"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-dim)] text-lg text-[var(--accent)]">
              {icon}
            </span>
            <h2 className="mt-4 font-semibold tracking-tight text-[var(--text)]">
              {title}
            </h2>
            <p className="mt-2 flex-1 text-sm text-[var(--text-muted)] leading-relaxed">
              {description}
            </p>
            <span className="mt-4 text-xs font-medium uppercase tracking-wider text-[var(--accent)] opacity-80">
              Open →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
