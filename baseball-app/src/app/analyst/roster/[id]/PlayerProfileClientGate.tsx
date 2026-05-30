"use client";

import { createClientGate } from "@/lib/ui/createClientGate";
import type { ComponentProps } from "react";
import type { PlayerProfileClient } from "./PlayerProfileClient";

export const PlayerProfileClientGate = createClientGate<ComponentProps<typeof PlayerProfileClient>>(
  () => import("./PlayerProfileClient").then((m) => ({ default: m.PlayerProfileClient })),
  { loadingMessage: "Loading player profile…", minHeightClass: "min-h-[50vh]" }
);
