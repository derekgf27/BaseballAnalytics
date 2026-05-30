"use client";

import { createClientGate } from "@/lib/ui/createClientGate";
import type { ComponentProps } from "react";
import type { GameLogPageClient } from "./GameLogPageClient";

export const GameLogPageClientGate = createClientGate<ComponentProps<typeof GameLogPageClient>>(
  () => import("./GameLogPageClient").then((m) => ({ default: m.GameLogPageClient })),
  { loadingMessage: "Loading game log…" }
);
