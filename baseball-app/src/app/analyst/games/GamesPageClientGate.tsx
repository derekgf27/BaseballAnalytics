"use client";

import { createClientGate } from "@/lib/ui/createClientGate";
import type { ComponentProps } from "react";
import type { GamesPageClient } from "./GamesPageClient";

export const GamesPageClientGate = createClientGate<ComponentProps<typeof GamesPageClient>>(
  () => import("./GamesPageClient").then((m) => ({ default: m.GamesPageClient })),
  { loadingMessage: "Loading games…" }
);
