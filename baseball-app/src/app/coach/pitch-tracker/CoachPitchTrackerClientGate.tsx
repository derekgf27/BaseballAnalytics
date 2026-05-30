"use client";

import { createClientGate } from "@/lib/ui/createClientGate";
import type { ComponentProps } from "react";
import type CoachPitchTrackerClient from "./CoachPitchTrackerClient";

export const CoachPitchTrackerClientGate = createClientGate<
  ComponentProps<typeof CoachPitchTrackerClient>
>(() => import("./CoachPitchTrackerClient"), {
  loadingMessage: "Loading pitch tracker…",
  minHeightClass: "min-h-[60vh]",
});
