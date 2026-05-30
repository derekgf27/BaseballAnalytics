import { revalidatePath } from "next/cache";

/** Invalidate list pages that load games after create/update/delete. */
export function revalidateGamesListCache(): void {
  revalidatePath("/analyst", "layout");
  revalidatePath("/coach", "layout");
  revalidatePath("/reports", "layout");
}

/** Invalidate list pages that load the roster after player writes. */
export function revalidatePlayersListCache(): void {
  revalidatePath("/analyst", "layout");
  revalidatePath("/coach", "layout");
  revalidatePath("/reports", "layout");
}

export function revalidateTrackedOpponentsCache(): void {
  revalidatePath("/analyst/opponents", "layout");
}
