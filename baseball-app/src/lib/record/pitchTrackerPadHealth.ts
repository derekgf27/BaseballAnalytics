export type PitchTrackerPadHealthLevel = "error" | "warning" | "info" | "success";

export type PitchTrackerPadHealthAlert = {
  level: PitchTrackerPadHealthLevel;
  title: string;
  detail: string;
};

export function resolvePitchTrackerPadHealthAlert(input: {
  enabled: boolean;
  coachPadConnected: boolean;
  everConnected: boolean;
  realtimeOk: boolean;
  fetchError: string | null;
  networkOnline: boolean;
  /** Coach typed pitches on iPad for this AB not yet in analyst pitch log. */
  coachTypesAwaitingLog: number;
}): PitchTrackerPadHealthAlert | null {
  if (!input.enabled) return null;

  if (!input.networkOnline) {
    return {
      level: "error",
      title: "You are offline",
      detail:
        "This Record session cannot reach the database — iPad pitch types will not appear until you reconnect.",
    };
  }

  // Ignore brief fetch blips before the coach pad has ever joined — show the softer "not connected" hint instead.
  const fetchErrorBlocksPad =
    input.fetchError &&
    (input.everConnected || input.coachPadConnected || input.coachTypesAwaitingLog > 0);

  if (fetchErrorBlocksPad) {
    return {
      level: "error",
      title: "Cannot load iPad pitches",
      detail: `${input.fetchError} Ask the coach to keep Pitch Tracker open; retry by refreshing Record.`,
    };
  }

  if (!input.realtimeOk) {
    return {
      level: "warning",
      title: "Live iPad sync paused on Record",
      detail:
        "Pitch types from the coach pad may not appear here until this page reconnects. Check Wi‑Fi and keep this tab open.",
    };
  }

  if (input.everConnected && !input.coachPadConnected) {
    return {
      level: "warning",
      title: "Coach pitch pad disconnected",
      detail:
        "The iPad is no longer connected to this game session — coach may have closed Pitch Tracker or lost Wi‑Fi. Have them reopen Coach → Pitch Tracker.",
    };
  }

  if (!input.coachPadConnected) {
    return {
      level: "info",
      title: "Coach pitch pad not connected",
      detail:
        "No iPad on this session yet. Coach should open Coach → Pitch Tracker and pick this game before logging pitch types.",
    };
  }

  return {
    level: "success",
    title: "Connected",
    detail: "Coach pitch pad is linked and live sync is active.",
  };
}
