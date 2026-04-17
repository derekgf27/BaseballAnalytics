import type { Game } from "@/lib/types";

export function sanitizeGameReviewPdfFilename(game: Game): string {
  const slug = (s: string) =>
    s
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 48) || "team";
  const away = slug(game.away_team);
  const home = slug(game.home_team);
  const date = String(game.date).replace(/[^\d-]/g, "").slice(0, 10);
  return `Game-review-${away}-at-${home}-${date}`;
}
