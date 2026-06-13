"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  pitchTrackerPresenceChannelId,
  type PitchTrackerPresencePayload,
} from "@/lib/pitchTracker/presence";

const PAD_DISCONNECT_DELAY_MS = 2_500;

type PresenceMeta = PitchTrackerPresencePayload & {
  presence_ref?: string;
};

function countCoachPads(state: Record<string, PresenceMeta[]>): number {
  let n = 0;
  for (const entries of Object.values(state)) {
    for (const entry of entries) {
      if (entry?.role === "coach") n += 1;
    }
  }
  return n;
}

/** Coach pad broadcasts presence; Record monitors whether a pad is online. */
export function usePitchTrackerPadPresence(
  groupId: string | null,
  mode: "track" | "monitor"
) {
  const [coachPadConnected, setCoachPadConnected] = useState(false);
  const [everConnected, setEverConnected] = useState(false);
  const disconnectTimerRef = useRef<number | null>(null);

  const clearDisconnectTimer = () => {
    if (disconnectTimerRef.current != null) {
      window.clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
  };

  const applyCoachPadConnected = (connected: boolean) => {
    if (connected) {
      clearDisconnectTimer();
      setCoachPadConnected(true);
      setEverConnected(true);
      return;
    }
    if (disconnectTimerRef.current != null) return;
    disconnectTimerRef.current = window.setTimeout(() => {
      disconnectTimerRef.current = null;
      setCoachPadConnected(false);
    }, PAD_DISCONNECT_DELAY_MS);
  };

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !groupId) {
      clearDisconnectTimer();
      setCoachPadConnected(false);
      return;
    }

    const channel = supabase.channel(pitchTrackerPresenceChannelId(groupId), {
      config: { presence: { key: mode === "track" ? "coach-pad" : "record-monitor" } },
    });

    const syncPresence = () => {
      const n = countCoachPads(channel.presenceState() as Record<string, PresenceMeta[]>);
      applyCoachPadConnected(n > 0);
    };

    if (mode === "monitor") {
      channel.on("presence", { event: "sync" }, syncPresence);
      channel.on("presence", { event: "join" }, syncPresence);
      channel.on("presence", { event: "leave" }, syncPresence);
    }

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        if (mode === "track") {
          const payload: PitchTrackerPresencePayload = {
            role: "coach",
            online_at: new Date().toISOString(),
          };
          await channel.track(payload);
        } else {
          syncPresence();
        }
      }
    });

    const heartbeat =
      mode === "track"
        ? window.setInterval(() => {
            if (channel.state !== "joined") return;
            void channel.track({
              role: "coach",
              online_at: new Date().toISOString(),
            } satisfies PitchTrackerPresencePayload);
          }, 25_000)
        : null;

    return () => {
      if (heartbeat != null) window.clearInterval(heartbeat);
      clearDisconnectTimer();
      if (mode === "track") void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [groupId, mode]);

  return { coachPadConnected, everConnected };
}
