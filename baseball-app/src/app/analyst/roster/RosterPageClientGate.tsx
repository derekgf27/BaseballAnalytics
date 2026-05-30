"use client";

import { createClientGate } from "@/lib/ui/createClientGate";
import type { ComponentProps } from "react";
import type { RosterPageClient } from "./RosterPageClient";

export const RosterPageClientGate = createClientGate<ComponentProps<typeof RosterPageClient>>(
  () => import("./RosterPageClient").then((m) => ({ default: m.RosterPageClient })),
  { loadingMessage: "Loading roster…" }
);
