"use client";

import { createClientGate } from "@/lib/ui/createClientGate";
import type { ComponentProps } from "react";
import type { StatsPageClient } from "./StatsPageClient";

export const StatsPageClientGate = createClientGate<ComponentProps<typeof StatsPageClient>>(
  () => import("./StatsPageClient").then((m) => ({ default: m.StatsPageClient })),
  { loadingMessage: "Loading stats…" }
);
