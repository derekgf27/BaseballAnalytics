"use client";

import { createClientGate } from "@/lib/ui/createClientGate";
import type { ComponentProps } from "react";
import type { CoachPlayersClient } from "./CoachPlayersClient";

export const CoachPlayersClientGate = createClientGate<ComponentProps<typeof CoachPlayersClient>>(
  () => import("./CoachPlayersClient").then((m) => ({ default: m.CoachPlayersClient })),
  { loadingMessage: "Loading players…" }
);
