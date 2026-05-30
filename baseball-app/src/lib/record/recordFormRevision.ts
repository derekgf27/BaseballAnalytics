import type { PersistedRecordFormState } from "@/lib/record/recordPageTypes";

export function nextFormRevision(current: number | undefined): number {
  return (current ?? 0) + 1;
}

export function isRemoteFormNewer(localRevision: number, remote: PersistedRecordFormState): boolean {
  return (remote.revision ?? 0) > localRevision;
}
