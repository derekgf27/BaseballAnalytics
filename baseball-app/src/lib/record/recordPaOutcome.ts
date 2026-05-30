import type { PAResult } from "@/lib/types";
import { RESULT_OPTIONS } from "@/lib/record/recordPageConstants";

/** 1→1B … 9→9th option; 0→10th (HBP). Indices ≥10 have no digit shortcut. */
export function outcomeShortcutDigit(value: PAResult): string | null {
  const idx = RESULT_OPTIONS.findIndex((o) => o.value === value);
  if (idx < 0 || idx > 9) return null;
  return String(idx);
}

export function outcomeIndexFromDigitKey(key: string): number | null {
  if (key < "0" || key > "9") return null;
  const n = Number(key);
  return n === 0 ? 9 : n - 1;
}

export function requiresRunnerOnBaseForResult(value: PAResult): boolean {
  return (
    value === "gidp" ||
    value === "fielders_choice" ||
    value === "sac_fly" ||
    value === "sac_bunt"
  );
}

export function resultBlockedByPitchCount(value: PAResult, balls: number, strikes: number): boolean {
  if (value === "so" || value === "so_looking") return strikes < 2;
  if (value === "bb") return balls < 3;
  return false;
}

export function pitchCountBlockHint(value: PAResult, balls: number, strikes: number): string | undefined {
  if (value === "so" || value === "so_looking") {
    return strikes < 2 ? "Set strikes to 2 before recording a strikeout." : undefined;
  }
  if (value === "bb") {
    return balls < 3 ? "Set balls to 3 before recording a walk (BB)." : undefined;
  }
  return undefined;
}

export function isWalkOrHbpResult(r: PAResult | null): boolean {
  return r === "bb" || r === "ibb" || r === "hbp";
}
