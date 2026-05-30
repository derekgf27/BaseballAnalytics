"use client";

import { createClientGate } from "@/lib/ui/createClientGate";
import type { ComponentProps } from "react";
import type { OpponentDetailClient } from "./OpponentDetailClient";

export const OpponentDetailClientGate = createClientGate<ComponentProps<typeof OpponentDetailClient>>(
  () => import("./OpponentDetailClient").then((m) => ({ default: m.OpponentDetailClient })),
  { loadingMessage: "Loading opponent…", minHeightClass: "min-h-[50vh]" }
);
