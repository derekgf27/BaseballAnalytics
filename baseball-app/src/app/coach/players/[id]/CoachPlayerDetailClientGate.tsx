"use client";

import { createClientGate } from "@/lib/ui/createClientGate";
import type { ComponentProps } from "react";
import type { CoachPlayerDetailClient } from "./CoachPlayerDetailClient";

export const CoachPlayerDetailClientGate = createClientGate<ComponentProps<typeof CoachPlayerDetailClient>>(
  () => import("./CoachPlayerDetailClient").then((m) => ({ default: m.CoachPlayerDetailClient })),
  { loadingMessage: "Loading player…" }
);
