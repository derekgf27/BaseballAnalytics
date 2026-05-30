"use client";

import { createClientGate } from "@/lib/ui/createClientGate";
import type { ComponentProps } from "react";
import type { ChartsClient } from "./ChartsClient";

export const ChartsClientGate = createClientGate<ComponentProps<typeof ChartsClient>>(
  () => import("./ChartsClient").then((m) => ({ default: m.ChartsClient })),
  { loadingMessage: "Loading charts…", minHeightClass: "min-h-[50vh]" }
);
