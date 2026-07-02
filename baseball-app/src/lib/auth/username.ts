import type { SupabaseClient } from "@supabase/supabase-js";

/** Internal auth email — users never see this; login is by username only. */
const LOGIN_EMAIL_DOMAIN = "login.baseballanalytics.internal";

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9][a-z0-9._]{2,31}$/.test(username);
}

export function usernameValidationMessage(): string {
  return "Username must be 3–32 characters: letters, numbers, dots, or underscores.";
}

/** Username as shown in the UI (no leading @). */
export function displayUsername(username: string): string {
  return username.trim().replace(/^@+/, "");
}

export function authEmailForUsername(username: string): string {
  return `${normalizeUsername(username)}@${LOGIN_EMAIL_DOMAIN}`;
}

/** Resolve the Supabase auth email for a login username. */
export async function resolveAuthEmailForUsername(
  supabase: SupabaseClient,
  rawUsername: string
): Promise<string | null> {
  const username = normalizeUsername(rawUsername);
  if (!isValidUsername(username)) return null;

  const { data, error } = await supabase.rpc("get_login_email_for_username", {
    p_username: username,
  });

  if (!error && typeof data === "string" && data.trim()) {
    return data.trim().toLowerCase();
  }

  // Users created in Admin with synthetic internal emails (no profiles.email row yet).
  return authEmailForUsername(username);
}
