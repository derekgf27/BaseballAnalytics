"use client";

import { createClientGate } from "@/lib/ui/createClientGate";
import type { ComponentProps } from "react";
import type { ReportsHubClient } from "./ReportsHubClient";

export const ReportsHubClientGate = createClientGate<ComponentProps<typeof ReportsHubClient>>(
  () => import("./ReportsHubClient").then((m) => ({ default: m.ReportsHubClient })),
  { loadingMessage: "Loading reports…", minHeightClass: "min-h-[50vh]" }
);
