"use server";

import { type User } from "@supabase/supabase-js";
import { parseAppRole, type AppRole } from "@/lib/auth/roles";
import { requireWritableAdminAccess } from "@/lib/auth/requireRole";
import {
  authEmailForUsername,
  displayUsername,
  isValidUsername,
  normalizeUsername,
  usernameValidationMessage,
} from "@/lib/auth/username";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AdminUserRow = {
  id: string;
  username: string;
  role: AppRole;
  createdAt: string;
  lastSignInAt: string | null;
};

export type AdminOrphanRow = {
  id: string;
  kind: "auth_only" | "profile_only";
  label: string;
};

type ListSuccess = {
  ok: true;
  users: AdminUserRow[];
  orphans: AdminOrphanRow[];
  adminConfigured: true;
};

type ListFailure = {
  ok: false;
  error: string;
  adminConfigured: boolean;
};

function authErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Request failed.";
}

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

function getAdminClient():
  | { ok: true; admin: AdminClient }
  | { ok: false; error: string } {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      error: "SUPABASE_SERVICE_ROLE_KEY is not configured on the server.",
    };
  }
  return { ok: true, admin };
}

async function listAllAuthUsers(admin: AdminClient): Promise<User[]> {
  const users: User[] = [];
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const batch = data.users ?? [];
    users.push(...batch);
    if (batch.length < 1000) break;
    page += 1;
  }

  return users;
}

async function countOtherAdmins(admin: AdminClient, excludeUserId: string): Promise<number> {
  const { count, error } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .neq("id", excludeUserId);

  if (error) throw error;
  return count ?? 0;
}

async function assertCanChangeAdminRole(
  admin: AdminClient,
  userId: string,
  nextRole: AppRole
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: row, error } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (row?.role !== "admin" || nextRole === "admin") return { ok: true };

  const otherAdmins = await countOtherAdmins(admin, userId);
  if (otherAdmins === 0) {
    return { ok: false, error: "Cannot remove the last admin account." };
  }

  return { ok: true };
}

export async function listAdminUsersAction(): Promise<ListSuccess | ListFailure> {
  try {
    await requireWritableAdminAccess();
    const client = getAdminClient();
    if (!client.ok) {
      return { ok: false, error: client.error, adminConfigured: false };
    }
    const admin = client.admin;

    const { data: profileRows, error: profileError } = await admin
      .from("profiles")
      .select("id, username, role, created_at")
      .order("created_at", { ascending: false });

    if (profileError) {
      return { ok: false, error: profileError.message, adminConfigured: true };
    }

    const authUsers = await listAllAuthUsers(admin);
    const authById = new Map(
      authUsers.map((u) => [u.id, { lastSignInAt: u.last_sign_in_at ?? null, email: u.email ?? null }])
    );
    const profileIds = new Set((profileRows ?? []).map((row) => (row as { id: string }).id));

    const users: AdminUserRow[] = (profileRows ?? []).map((row) => {
      const r = row as {
        id: string;
        username: string | null;
        role: string;
        created_at: string;
      };
      const auth = authById.get(r.id);
      return {
        id: r.id,
        username: r.username ?? "—",
        role: parseAppRole(r.role) ?? "coach",
        createdAt: r.created_at,
        lastSignInAt: auth?.lastSignInAt ?? null,
      };
    });

    const orphans: AdminOrphanRow[] = [
      ...authUsers
        .filter((u) => !profileIds.has(u.id))
        .map((u) => ({
          id: u.id,
          kind: "auth_only" as const,
          label: u.email ?? u.id,
        })),
      ...(profileRows ?? [])
        .filter((row) => !authById.has((row as { id: string }).id))
        .map((row) => {
          const r = row as { id: string; username: string | null };
          return {
            id: r.id,
            kind: "profile_only" as const,
            label: r.username ? displayUsername(r.username) : r.id,
          };
        }),
    ];

    return { ok: true, users, orphans, adminConfigured: true };
  } catch (e) {
    return { ok: false, error: authErrorMessage(e), adminConfigured: true };
  }
}

export async function createAdminUserAction(input: {
  username: string;
  password: string;
  role: AppRole;
}): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  try {
    await requireWritableAdminAccess();
    const client = getAdminClient();
    if (!client.ok) return { ok: false, error: client.error };
    const admin = client.admin;

    const username = normalizeUsername(input.username);
    const password = input.password;
    if (!isValidUsername(username)) {
      return { ok: false, error: usernameValidationMessage() };
    }
    if (password.length < 8) {
      return { ok: false, error: "Password must be at least 8 characters." };
    }

    const { data: taken } = await admin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (taken) {
      return { ok: false, error: "That username is already taken." };
    }

    const email = authEmailForUsername(username);

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: input.role, username },
    });

    if (error || !data.user) {
      return { ok: false, error: error?.message ?? "Could not create user." };
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        role: input.role,
        email,
        username,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.user.id);

    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return {
        ok: false,
        error: `Could not finish setting up the profile. ${profileError.message}`,
      };
    }

    return { ok: true, userId: data.user.id };
  } catch (e) {
    return { ok: false, error: authErrorMessage(e) };
  }
}

export async function updateAdminUserAction(input: {
  userId: string;
  role: AppRole;
  password?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { userId: actorId } = await requireWritableAdminAccess();
    const client = getAdminClient();
    if (!client.ok) return { ok: false, error: client.error };
    const admin = client.admin;

    const userId = input.userId.trim();
    if (!userId) return { ok: false, error: "Missing user id." };

    if (userId === actorId && input.role !== "admin") {
      return {
        ok: false,
        error: "You cannot remove your own admin role. Ask another admin to change it.",
      };
    }

    const adminGuard = await assertCanChangeAdminRole(admin, userId, input.role);
    if (!adminGuard.ok) return adminGuard;

    const password = input.password?.trim() ?? "";
    if (password.length > 0 && password.length < 8) {
      return { ok: false, error: "Password must be at least 8 characters." };
    }

    const authPatch: { app_metadata: { role: AppRole }; password?: string } = {
      app_metadata: { role: input.role },
    };
    if (password.length >= 8) authPatch.password = password;

    const { error: authError } = await admin.auth.admin.updateUserById(userId, authPatch);
    if (authError) return { ok: false, error: authError.message };

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        role: input.role,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (profileError) return { ok: false, error: profileError.message };

    return { ok: true };
  } catch (e) {
    return { ok: false, error: authErrorMessage(e) };
  }
}

export async function deleteAdminUserAction(
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { userId: actorId } = await requireWritableAdminAccess();
    if (userId === actorId) {
      return { ok: false, error: "You cannot delete your own account while signed in." };
    }

    const client = getAdminClient();
    if (!client.ok) return { ok: false, error: client.error };
    const admin = client.admin;

    const adminGuard = await assertCanChangeAdminRole(admin, userId, "coach");
    if (!adminGuard.ok) return adminGuard;

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return { ok: false, error: error.message };

    return { ok: true };
  } catch (e) {
    return { ok: false, error: authErrorMessage(e) };
  }
}

export async function removeAuthOrphanAction(
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireWritableAdminAccess();
    const client = getAdminClient();
    if (!client.ok) return { ok: false, error: client.error };
    const admin = client.admin;

    const { data: profile } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (profile) {
      return { ok: false, error: "This auth user already has a profile row." };
    }

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return { ok: false, error: error.message };

    return { ok: true };
  } catch (e) {
    return { ok: false, error: authErrorMessage(e) };
  }
}

export async function removeProfileOrphanAction(
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireWritableAdminAccess();
    const client = getAdminClient();
    if (!client.ok) return { ok: false, error: client.error };
    const admin = client.admin;

    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    if (authUser.user) {
      return { ok: false, error: "This profile still has a matching auth user." };
    }

    const { error } = await admin.from("profiles").delete().eq("id", userId);
    if (error) return { ok: false, error: error.message };

    return { ok: true };
  } catch (e) {
    return { ok: false, error: authErrorMessage(e) };
  }
}
