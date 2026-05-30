"use client";

import { createClientGate } from "@/lib/ui/createClientGate";
import type { ComponentProps } from "react";
import type { CoachTodayClient } from "./CoachTodayClient";

export const CoachTodayClientGate = createClientGate<ComponentProps<typeof CoachTodayClient>>(
  () => import("./CoachTodayClient").then((m) => ({ default: m.CoachTodayClient })),
  { loadingMessage: "Loading coach dashboard…" }
);
