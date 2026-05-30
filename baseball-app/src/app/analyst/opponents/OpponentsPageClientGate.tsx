"use client";

import { createClientGate } from "@/lib/ui/createClientGate";
import type { ComponentProps } from "react";
import type { OpponentsPageClient } from "./OpponentsPageClient";

export const OpponentsPageClientGate = createClientGate<ComponentProps<typeof OpponentsPageClient>>(
  () => import("./OpponentsPageClient").then((m) => ({ default: m.OpponentsPageClient })),
  { loadingMessage: "Loading opponents…" }
);
