"use client";

import { createClientGate } from "@/lib/ui/createClientGate";
import type { ComponentProps } from "react";
import type { GameReviewClient } from "./GameReviewClient";

export const GameReviewClientGate = createClientGate<ComponentProps<typeof GameReviewClient>>(
  () => import("./GameReviewClient").then((m) => ({ default: m.GameReviewClient })),
  { loadingMessage: "Loading box score…", minHeightClass: "min-h-[50vh]" }
);
