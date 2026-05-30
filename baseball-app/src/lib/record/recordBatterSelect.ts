import type { Bats } from "@/lib/types";

export function batterBatsLetter(bats: Bats | null | undefined): string | null {
  if (bats === "L" || bats === "R" || bats === "S") return bats;
  return null;
}

export function batterSelectOptionText(entry: {
  slot: number;
  name: string;
  jersey: string | null;
  bats: string | null;
}): string {
  const j = entry.jersey ? ` #${entry.jersey}` : "";
  const h = entry.bats ? ` · ${entry.bats}` : "";
  return `${entry.slot}. ${entry.name}${j}${h}`;
}
