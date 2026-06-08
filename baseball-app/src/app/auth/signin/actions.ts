"use server";

import { resolveUserRole } from "@/lib/auth/profile";
import type { AppRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isValidUsername,
  normalizeUsername,
  resolveAuthEmailForUsername,
  usernameValidationMessage,
} from "@/lib/auth/username";

export async function signInWithUsernameAction(
  username: string,
  password: string
): Promise<{ ok: true; role: AppRole | null } | { ok: false; error: string }> {
  const norm = normalizeUsername(username);
  if (!isValidUsername(norm)) {
    return { ok: false, error: usernameValidationMessage() };
  }
  if (!password) {
    return { ok: false, error: "Enter your password." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const email = await resolveAuthEmailForUsername(supabase, norm);
  if (!email) {
    return { ok: false, error: usernameValidationMessage() };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const msg =
      error.message === "Invalid login credentials"
        ? "Incorrect username or password."
        : error.message;
    return { ok: false, error: msg };
  }

  const role = user ? await resolveUserRole(supabase, user) : null;
  return { ok: true, role };
}
