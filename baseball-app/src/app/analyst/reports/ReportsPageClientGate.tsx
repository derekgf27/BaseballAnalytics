"use client";

import { createClientGate } from "@/lib/ui/createClientGate";
import type { ComponentProps } from "react";
import type { ReportsPageClient } from "./ReportsPageClient";

export const ReportsPageClientGate = createClientGate<ComponentProps<typeof ReportsPageClient>>(
  () => import("./ReportsPageClient").then((m) => ({ default: m.ReportsPageClient })),
  { loadingMessage: "Loading PDF reports…", minHeightClass: "min-h-[50vh]" }
);
