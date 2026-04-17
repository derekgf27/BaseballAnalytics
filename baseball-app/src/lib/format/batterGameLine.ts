import { battingStatsFromPAs } from "@/lib/compute/battingStats";
import type { PAResult, PlateAppearance } from "@/lib/types";

function paChronological(a: PlateAppearance, b: PlateAppearance): number {
  if (a.inning !== b.inning) return a.inning - b.inning;
  const ha = a.inning_half === "top" ? 0 : 1;
  const hb = b.inning_half === "top" ? 0 : 1;
  if (ha !== hb) return ha - hb;
  const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
  const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
  return ta - tb;
}

function abbrevForResultCore(r: PAResult): string | null {
  switch (r) {
    case "single":
      return "1B";
    case "double":
      return "2B";
    case "triple":
      return "3B";
    case "hr":
      return "HR";
    case "bb":
      return "BB";
    case "ibb":
      return "IBB";
    case "hbp":
      return "HBP";
    case "so":
    case "so_looking":
      return "K";
    case "sac_fly":
    case "sac":
      return "SF";
    case "sac_bunt":
      return "SH";
    case "fielders_choice":
      return "FC";
    case "gidp":
      return "GIDP";
    case "out":
      return "OUT";
    case "reached_on_error":
      return "E";
    case "other":
      return null;
    default:
      return null;
  }
}

function abbrevForPa(pa: PlateAppearance): string | null {
  const base = abbrevForResultCore(pa.result);
  if (!base) return null;
  const hitPlusE =
    pa.error_fielder_id &&
    (pa.result === "single" || pa.result === "double" || pa.result === "triple");
  return hitPlusE ? `${base}+E` : base;
}

/**
 * In-game batting line, e.g. `2-3, HR, BB, 2B, 3RBI` (H-AB, chronological PA results, total RBI).
 */
export function formatBatterGameStatLine(pas: PlateAppearance[]): string {
  if (pas.length === 0) return "—";
  const stats = battingStatsFromPAs(pas);
  if (!stats) return "—";

  const sorted = [...pas].sort(paChronological);
  const events = sorted
    .map((pa) => abbrevForPa(pa))
    .filter((x): x is string => x != null);

  const hAb = `${stats.h}-${stats.ab}`;
  const rbi = stats.rbi ?? 0;

  let line = events.length > 0 ? `${hAb}, ${events.join(", ")}` : hAb;
  if (rbi > 0) {
    line += `, ${rbi}RBI`;
  }
  return line;
}
