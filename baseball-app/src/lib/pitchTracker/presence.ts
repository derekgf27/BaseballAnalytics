/** Shared Supabase presence channel for coach pitch pad ↔ analyst Record. */
export function pitchTrackerPresenceChannelId(groupId: string): string {
  return `pitch-pad-presence-${groupId}`;
}

export type PitchTrackerPresencePayload = {
  role: "coach";
  online_at: string;
};
