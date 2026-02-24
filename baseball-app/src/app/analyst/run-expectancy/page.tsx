import { getAllPlateAppearancesForRunExpectancy } from "@/lib/db/queries";
import {
  buildRETable,
  buildRECounts,
  BASE_STATES,
  OUTS,
} from "@/lib/compute/runExpectancy";
import { RunExpectancyClient } from "./RunExpectancyClient";
import type { RETable } from "@/lib/compute/runExpectancy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RunExpectancyPage() {
  const pas = await getAllPlateAppearancesForRunExpectancy();
  const reTable: RETable = buildRETable(pas);
  const counts = buildRECounts(pas);
  return (
    <RunExpectancyClient
      reTable={reTable}
      counts={counts}
      baseStates={BASE_STATES}
      outsList={[...OUTS]}
      totalPA={pas.length}
    />
  );
}
