"use client";

import { createClientGate } from "@/lib/ui/createClientGate";
import type { ComponentProps } from "react";
import type { CoachMatchupClient } from "./CoachMatchupClient";

export const CoachMatchupClientGate = createClientGate<ComponentProps<typeof CoachMatchupClient>>(
  () => import("./CoachMatchupClient").then((m) => ({ default: m.CoachMatchupClient })),
  { loadingMessage: "Loading matchup…" }
);
