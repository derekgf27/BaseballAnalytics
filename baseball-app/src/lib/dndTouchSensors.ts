"use client";

import { MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";

/**
 * Sensors tuned for iPad / touch: avoids relying on Pointer-only + distance, which often
 * feels like the page “wins” the gesture until you move slowly.
 *
 * Pair draggable surfaces with `touch-none select-none` (Tailwind) so Safari does not
 * scroll-steal before @dnd-kit activates.
 */
export function useTouchOptimizedDndSensors() {
  return useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 0,
        tolerance: 12,
      },
    })
  );
}
