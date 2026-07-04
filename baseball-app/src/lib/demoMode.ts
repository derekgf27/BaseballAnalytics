/**
 * Portfolio demo mode — read-only public deployment with seeded sample data.
 * Set NEXT_PUBLIC_DEMO_MODE=true on the demo Vercel project.
 */

import { isDemoId } from "@/lib/db/mockData";

export const DEMO_READ_ONLY_MESSAGE =
  "Portfolio demo is read-only. Deploy your own instance to save changes.";

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

/** True in portfolio demo mode or for legacy demo-* entity ids. */
export function isEntityReadOnly(id?: string | null): boolean {
  if (isDemoMode()) return true;
  return id != null && isDemoId(id);
}

/** True when Supabase is connected and the app is not in read-only demo mode. */
export function canMutateData(): boolean {
  const hasSupabase = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  return hasSupabase && !isDemoMode();
}

export function demoMutationBlocked(): { ok: false; error: string } | null {
  if (isDemoMode()) return { ok: false, error: DEMO_READ_ONLY_MESSAGE };
  return null;
}

/** Use at the top of server actions that write data. */
export function assertDemoWritable(): void {
  if (isDemoMode()) throw new Error(DEMO_READ_ONLY_MESSAGE);
}

/** User-facing message when edit controls are hidden. */
export function dataEditBlockedMessage(fallback = "Connect Supabase to save changes."): string {
  if (isDemoMode()) return DEMO_READ_ONLY_MESSAGE;
  return fallback;
}
