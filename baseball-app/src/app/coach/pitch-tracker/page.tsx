import CoachPitchTrackerClient from "./CoachPitchTrackerClient";

export default async function CoachPitchTrackerPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const p = await searchParams;
  const gameId = typeof p.gameId === "string" ? p.gameId : undefined;
  const groupId = typeof p.groupId === "string" ? p.groupId : undefined;
  const batterId = typeof p.batterId === "string" ? p.batterId : undefined;
  const pitcherId = typeof p.pitcherId === "string" ? p.pitcherId : null;

  return (
    <CoachPitchTrackerClient
      gameId={gameId}
      groupId={groupId}
      batterId={batterId}
      pitcherId={pitcherId}
    />
  );
}
