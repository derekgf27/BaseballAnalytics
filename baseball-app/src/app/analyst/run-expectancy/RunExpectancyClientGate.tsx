"use client";

import { createClientGate } from "@/lib/ui/createClientGate";
import type { ComponentProps } from "react";
import type { RunExpectancyClient } from "./RunExpectancyClient";

export const RunExpectancyClientGate = createClientGate<ComponentProps<typeof RunExpectancyClient>>(
  () => import("./RunExpectancyClient").then((m) => ({ default: m.RunExpectancyClient })),
  { loadingMessage: "Loading run expectancy…" }
);
