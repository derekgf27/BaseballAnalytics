"use client";

import { createClientGate } from "@/lib/ui/createClientGate";
import type { ComponentProps } from "react";
import type { ScheduleCalendar } from "./ScheduleCalendar";

export const ScheduleCalendarGate = createClientGate<ComponentProps<typeof ScheduleCalendar>>(
  () => import("./ScheduleCalendar").then((m) => ({ default: m.ScheduleCalendar })),
  { loadingMessage: "Loading schedule…", minHeightClass: "min-h-[12rem]" }
);
