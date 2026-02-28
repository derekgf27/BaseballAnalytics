import { redirect } from "next/navigation";
import { getGame } from "@/lib/db/queries";
import { notFound } from "next/navigation";

/** /analyst/games/[id]/log redirects to Record PAs with this game pre-selected. */
export default async function GameLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();
  redirect(`/analyst/record?gameId=${id}`);
}
