"use client";

import { createClientGate } from "@/lib/ui/createClientGate";
import type { ComponentProps } from "react";
import type { AssistantPageClient } from "./AssistantPageClient";

export const AssistantPageClientGate = createClientGate<ComponentProps<typeof AssistantPageClient>>(
  () => import("./AssistantPageClient").then((m) => ({ default: m.AssistantPageClient })),
  { loadingMessage: "Loading assistant…" }
);
