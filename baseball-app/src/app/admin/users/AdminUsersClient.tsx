"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { FlashMessage } from "@/components/shared/FlashMessage";
import { useFlashMessage } from "@/hooks/useFlashMessage";
import { roleBadgeClassName, roleLabel, type AppRole } from "@/lib/auth/roles";
import { isValidUsername, usernameValidationMessage } from "@/lib/auth/username";
import {
  createAdminUserAction,
  deleteAdminUserAction,
  listAdminUsersAction,
  removeAuthOrphanAction,
  removeProfileOrphanAction,
  updateAdminUserAction,
  type AdminOrphanRow,
  type AdminUserRow,
} from "./actions";

const ROLES: AppRole[] = ["coach", "analyst", "admin"];
const PAGE_SIZE = 25;

type SortKey = "username" | "role" | "created" | "lastSignIn";
type RoleFilter = "all" | AppRole;

const fieldLabel =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--neo-text-muted)]";
const inputClass =
  "mt-1 h-11 w-full rounded-lg border border-[var(--neo-border)] bg-[var(--neo-bg-base)] px-3 text-sm text-[var(--neo-text)] focus:border-[var(--neo-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]/20";
const passwordInputClass =
  "h-11 w-full rounded-lg border border-[var(--neo-border)] bg-[var(--neo-bg-base)] py-0 pl-3 pr-11 text-sm text-[var(--neo-text)] focus:border-[var(--neo-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]/20";

function useModalDialog(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    const firstField = panelRef.current?.querySelector<HTMLElement>(
      'input:not([readonly]):not([type="hidden"]), select, button:not([disabled])'
    );
    firstField?.focus();

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return panelRef;
}

function ModalShell({
  open,
  onClose,
  titleId,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  titleId: string;
  title: string;
  children: ReactNode;
}) {
  const panelRef = useModalDialog(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px] sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={panelRef}
        className="card-tech w-full max-w-lg overflow-hidden shadow-2xl ring-1 ring-violet-500/25"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-[var(--neo-border)]/80 bg-violet-500/10 px-6 py-4">
          <h2
            id={titleId}
            className="font-orbitron text-lg font-semibold uppercase tracking-wide text-violet-100 sm:text-xl"
          >
            {title}
          </h2>
        </header>
        {children}
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  required = false,
  minLength,
  autoComplete = "new-password",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block">
      <span className={fieldLabel}>{label}</span>
      <div className="relative mt-1">
        <input
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={passwordInputClass}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-violet-300 transition hover:bg-violet-500/15 hover:text-violet-100"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </label>
  );
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function resetCreateForm(setters: {
  setCreateUsername: (v: string) => void;
  setCreatePassword: (v: string) => void;
  setCreateConfirmPassword: (v: string) => void;
  setCreateRole: (v: AppRole) => void;
}) {
  setters.setCreateUsername("");
  setters.setCreatePassword("");
  setters.setCreateConfirmPassword("");
  setters.setCreateRole("coach");
}

function sortUsers(users: AdminUserRow[], sortKey: SortKey, sortAsc: boolean): AdminUserRow[] {
  const dir = sortAsc ? 1 : -1;
  return [...users].sort((a, b) => {
    if (sortKey === "username") {
      return a.username.localeCompare(b.username) * dir;
    }
    if (sortKey === "role") {
      return a.role.localeCompare(b.role) * dir;
    }
    if (sortKey === "created") {
      return (Date.parse(a.createdAt) - Date.parse(b.createdAt)) * dir;
    }
    const aTime = a.lastSignInAt ? Date.parse(a.lastSignInAt) : 0;
    const bTime = b.lastSignInAt ? Date.parse(b.lastSignInAt) : 0;
    return (aTime - bTime) * dir;
  });
}

export function AdminUsersClient({
  initialUsers,
  initialOrphans,
  initialError = null,
  adminConfigured,
}: {
  initialUsers: AdminUserRow[];
  initialOrphans: AdminOrphanRow[];
  initialError?: string | null;
  adminConfigured: boolean;
}) {
  const { message, dismissing, show: showFlash } = useFlashMessage();
  const [users, setUsers] = useState(initialUsers);
  const [orphans, setOrphans] = useState(initialOrphans);
  const [busy, setBusy] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createUsername, setCreateUsername] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createConfirmPassword, setCreateConfirmPassword] = useState("");
  const [createRole, setCreateRole] = useState<AppRole>("coach");

  const [editingUser, setEditingUser] = useState<AdminUserRow | null>(null);
  const [editRole, setEditRole] = useState<AppRole>("coach");
  const [editPassword, setEditPassword] = useState("");
  const [editConfirmPassword, setEditConfirmPassword] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);

  useEffect(() => {
    if (initialError) {
      showFlash({ type: "err", text: initialError });
    }
  }, [initialError, showFlash]);

  const refresh = useCallback(async () => {
    const res = await listAdminUsersAction();
    if (res.ok) {
      setUsers(res.users);
      setOrphans(res.orphans);
    } else {
      showFlash({ type: "err", text: res.error });
    }
  }, [showFlash]);

  const counts = useMemo(() => {
    const c = { coach: 0, analyst: 0, admin: 0 };
    for (const u of users) c[u.role] += 1;
    return c;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = users;
    if (roleFilter !== "all") {
      list = list.filter((u) => u.role === roleFilter);
    }
    if (q) {
      list = list.filter((u) => u.username.toLowerCase().includes(q));
    }
    return sortUsers(list, sortKey, sortAsc);
  }, [users, searchQuery, roleFilter, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const pageUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, page]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, roleFilter, sortKey, sortAsc]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const closeCreateForm = useCallback(() => {
    if (busy) return;
    setCreateOpen(false);
    resetCreateForm({
      setCreateUsername,
      setCreatePassword,
      setCreateConfirmPassword,
      setCreateRole,
    });
  }, [busy]);

  const closeEditForm = useCallback(() => {
    if (busy) return;
    setEditingUser(null);
    setEditRole("coach");
    setEditPassword("");
    setEditConfirmPassword("");
  }, [busy]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const username = createUsername.trim().toLowerCase();
    if (!isValidUsername(username)) {
      showFlash({ type: "err", text: usernameValidationMessage() });
      return;
    }
    if (createPassword !== createConfirmPassword) {
      showFlash({ type: "err", text: "Passwords do not match." });
      return;
    }

    setBusy(true);
    const res = await createAdminUserAction({
      username,
      password: createPassword,
      role: createRole,
    });
    setBusy(false);
    if (!res.ok) {
      showFlash({ type: "err", text: res.error });
      return;
    }
    showFlash({ type: "ok", text: `Created @${username}` });
    setCreateOpen(false);
    resetCreateForm({
      setCreateUsername,
      setCreatePassword,
      setCreateConfirmPassword,
      setCreateRole,
    });
    await refresh();
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;

    const nextPassword = editPassword.trim();
    const nextConfirm = editConfirmPassword.trim();
    if (nextPassword || nextConfirm) {
      if (nextPassword !== nextConfirm) {
        showFlash({ type: "err", text: "Passwords do not match." });
        return;
      }
      if (nextPassword.length < 8) {
        showFlash({ type: "err", text: "Password must be at least 8 characters." });
        return;
      }
    }

    setBusy(true);
    const res = await updateAdminUserAction({
      userId: editingUser.id,
      role: editRole,
      password: nextPassword || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      showFlash({ type: "err", text: res.error });
      return;
    }
    showFlash({ type: "ok", text: `Updated @${editingUser.username}` });
    closeEditForm();
    await refresh();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    const res = await deleteAdminUserAction(deleteTarget.id);
    setBusy(false);
    if (!res.ok) {
      showFlash({ type: "err", text: res.error });
      return;
    }
    showFlash({ type: "deleted", text: `Deleted @${deleteTarget.username}` });
    setDeleteTarget(null);
    await refresh();
  }

  async function handleRemoveOrphan(orphan: AdminOrphanRow) {
    setBusy(true);
    const res =
      orphan.kind === "auth_only"
        ? await removeAuthOrphanAction(orphan.id)
        : await removeProfileOrphanAction(orphan.id);
    setBusy(false);
    if (!res.ok) {
      showFlash({ type: "err", text: res.error });
      return;
    }
    showFlash({ type: "ok", text: "Removed orphaned account record." });
    await refresh();
  }

  const createUsernameHint =
    createUsername.trim() && !isValidUsername(createUsername.trim().toLowerCase())
      ? usernameValidationMessage()
      : null;

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    roleFilter !== "all" ||
    sortKey !== "created" ||
    sortAsc;

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (searchQuery.trim()) parts.push(`“${searchQuery.trim()}”`);
    if (roleFilter !== "all") parts.push(roleLabel(roleFilter));
    const sortLabels: Record<SortKey, string> = {
      username: "Username",
      role: "Role",
      created: "Created",
      lastSignIn: "Last sign-in",
    };
    parts.push(`${sortLabels[sortKey]} ${sortAsc ? "↑" : "↓"}`);
    return parts.join(" · ");
  }, [searchQuery, roleFilter, sortKey, sortAsc]);

  function clearFilters() {
    setSearchQuery("");
    setRoleFilter("all");
    setSortKey("created");
    setSortAsc(false);
  }

  return (
    <div className="min-h-full pb-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--neo-text)] sm:text-3xl">
            User profiles
          </h1>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={!adminConfigured}
            title={
              adminConfigured
                ? undefined
                : "Configure SUPABASE_SERVICE_ROLE_KEY on the server to add users."
            }
            className="font-orbitron min-h-[44px] rounded-lg border border-violet-500/40 bg-violet-500/15 px-4 text-sm font-semibold tracking-wide text-violet-200 transition hover:border-violet-400/60 hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add user
          </button>
        </header>

        {!adminConfigured ? (
          <p className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
            Admin user management requires{" "}
            <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code> on the server. Add it to{" "}
            <code className="text-xs">.env.local</code> (and Vercel for production), then restart
            the dev server.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3 text-xs text-[var(--neo-text-muted)]">
          <span className="rounded-full border border-[var(--neo-border)] px-3 py-1">
            {users.length} total
          </span>
          <span className="rounded-full border border-[var(--neo-border)] px-3 py-1">
            {counts.coach} coaches
          </span>
          <span className="rounded-full border border-[var(--neo-border)] px-3 py-1">
            {counts.analyst} analysts
          </span>
          <span className="rounded-full border border-[var(--neo-border)] px-3 py-1">
            {counts.admin} admins
          </span>
        </div>

        {orphans.length > 0 ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <p className="font-semibold">Account sync issues ({orphans.length})</p>
            <ul className="mt-2 space-y-2">
              {orphans.map((orphan) => (
                <li
                  key={`${orphan.kind}-${orphan.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 text-amber-100/90"
                >
                  <span>
                    {orphan.kind === "auth_only" ? "Auth only" : "Profile only"}: {orphan.label}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleRemoveOrphan(orphan)}
                    className="rounded-md border border-amber-500/40 px-2.5 py-1 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/15 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <FlashMessage message={message} dismissing={dismissing} />

        <section className="neo-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              aria-expanded={filtersOpen}
              aria-controls="admin-users-filters"
            >
              <span
                className="font-orbitron text-sm font-semibold uppercase tracking-wide text-violet-200"
                aria-hidden
              >
                {filtersOpen ? "▾" : "▸"}
              </span>
              <span className="font-orbitron text-sm font-semibold uppercase tracking-wide text-violet-200">
                Filters
              </span>
              {!filtersOpen ? (
                <span className="truncate text-xs font-normal normal-case tracking-normal text-[var(--neo-text-muted)]">
                  {filterSummary}
                </span>
              ) : null}
            </button>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="shrink-0 text-xs font-medium text-violet-300 transition hover:text-violet-100"
              >
                Clear
              </button>
            ) : null}
          </div>

          {filtersOpen ? (
            <div
              id="admin-users-filters"
              className="flex flex-wrap items-end gap-3 border-t border-[var(--neo-border)] px-4 pb-4 pt-3"
            >
              <label className="min-w-0 flex-1 sm:max-w-sm">
                <span className={fieldLabel}>Search</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={inputClass}
                  autoComplete="off"
                />
              </label>
              <label className="w-full sm:w-auto">
                <span className={fieldLabel}>Role</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
                  className={inputClass}
                >
                  <option value="all">All roles</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="w-full sm:w-auto">
                <span className={fieldLabel}>Sort by</span>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className={inputClass}
                >
                  <option value="username">Username</option>
                  <option value="role">Role</option>
                  <option value="created">Created</option>
                  <option value="lastSignIn">Last sign-in</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => setSortAsc((v) => !v)}
                className="min-h-[44px] rounded-lg border border-[var(--neo-border)] px-3 text-sm text-[var(--neo-text-muted)] transition hover:border-[var(--neo-border-focus)] hover:text-[var(--neo-text)]"
                aria-label={sortAsc ? "Sort ascending" : "Sort descending"}
              >
                {sortAsc ? "↑ Asc" : "↓ Desc"}
              </button>
            </div>
          ) : null}
        </section>

        <ModalShell
          open={createOpen}
          onClose={closeCreateForm}
          titleId="admin-add-user-title"
          title="Add user"
        >
          <form onSubmit={handleCreate}>
            <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className={fieldLabel}>Username (login)</span>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={createUsername}
                  onChange={(e) => setCreateUsername(e.target.value)}
                  className={inputClass}
                />
                <span className="mt-1.5 block text-xs text-[var(--neo-text-muted)]">
                  {usernameValidationMessage()}
                </span>
                {createUsernameHint ? (
                  <span className="mt-1 block text-xs text-[var(--danger)]">{createUsernameHint}</span>
                ) : null}
              </label>
              <PasswordField
                label="Password"
                value={createPassword}
                onChange={setCreatePassword}
                required
                minLength={8}
              />
              <PasswordField
                label="Confirm password"
                value={createConfirmPassword}
                onChange={setCreateConfirmPassword}
                required
                minLength={8}
              />
              <label className="block sm:col-span-2">
                <span className={fieldLabel}>Role</span>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as AppRole)}
                  className={inputClass}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--neo-border)]/80 bg-violet-500/5 px-6 py-4">
              <button
                type="button"
                onClick={closeCreateForm}
                disabled={busy}
                className="rounded-lg border border-[var(--neo-border)] bg-[var(--neo-bg-base)] px-4 py-2.5 text-sm font-medium text-[var(--neo-text-muted)] transition hover:border-[var(--neo-border-focus)] hover:text-[var(--neo-text)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="font-orbitron min-h-[44px] rounded-lg bg-violet-500 px-5 text-sm font-semibold tracking-wide text-white transition hover:bg-violet-400 disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create user"}
              </button>
            </footer>
          </form>
        </ModalShell>

        <ModalShell
          open={!!editingUser}
          onClose={closeEditForm}
          titleId="admin-edit-user-title"
          title="Edit user"
        >
          {editingUser ? (
            <form onSubmit={handleEdit}>
              <div className="grid gap-4 px-6 py-5">
                <label className="block">
                  <span className={fieldLabel}>Username</span>
                  <input
                    type="text"
                    readOnly
                    value={`@${editingUser.username}`}
                    className={`${inputClass} cursor-default opacity-80`}
                  />
                </label>
                <label className="block">
                  <span className={fieldLabel}>Role</span>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as AppRole)}
                    className={inputClass}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r)}
                      </option>
                    ))}
                  </select>
                </label>
                <PasswordField
                  label="New password"
                  value={editPassword}
                  onChange={setEditPassword}
                  autoComplete="new-password"
                />
                <PasswordField
                  label="Confirm new password"
                  value={editConfirmPassword}
                  onChange={setEditConfirmPassword}
                  autoComplete="new-password"
                />
                <span className="text-xs text-[var(--neo-text-muted)]">
                  Leave password fields blank to keep the current password.
                </span>
              </div>
              <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--neo-border)]/80 bg-violet-500/5 px-6 py-4">
                <button
                  type="button"
                  onClick={closeEditForm}
                  disabled={busy}
                  className="rounded-lg border border-[var(--neo-border)] bg-[var(--neo-bg-base)] px-4 py-2.5 text-sm font-medium text-[var(--neo-text-muted)] transition hover:border-[var(--neo-border-focus)] hover:text-[var(--neo-text)] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="font-orbitron min-h-[44px] rounded-lg bg-violet-500 px-5 text-sm font-semibold tracking-wide text-white transition hover:bg-violet-400 disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save changes"}
                </button>
              </footer>
            </form>
          ) : null}
        </ModalShell>

        <ConfirmDeleteDialog
          open={!!deleteTarget}
          onClose={() => !busy && setDeleteTarget(null)}
          title={deleteTarget ? `Delete @${deleteTarget.username}?` : "Delete user?"}
          description="This cannot be undone. The user will lose access immediately."
          confirmLabel="Delete user"
          pendingLabel="Deleting…"
          pending={busy}
          onConfirm={handleConfirmDelete}
        />

        <div className="neo-card overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--neo-border)] text-xs uppercase tracking-wide text-[var(--neo-text-muted)]">
                <th className="px-4 py-3 font-semibold">Username</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold">Last sign-in</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--neo-text-muted)]">
                    {users.length === 0 ? (
                      <div className="space-y-3">
                        <p>No users yet.</p>
                        {adminConfigured ? (
                          <button
                            type="button"
                            onClick={() => setCreateOpen(true)}
                            className="font-orbitron rounded-lg border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-sm font-semibold tracking-wide text-violet-200 transition hover:bg-violet-500/25"
                          >
                            Add your first user
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      "No users match your filters."
                    )}
                  </td>
                </tr>
              ) : (
                pageUsers.map((user) => (
                  <tr key={user.id} className="border-b border-[var(--neo-border)]/60">
                    <td className="px-4 py-3 font-medium text-[var(--neo-text)]">@{user.username}</td>
                    <td className="px-4 py-3">
                      <span className={`${roleBadgeClassName(user.role)} inline-flex max-w-full truncate`}>
                        {roleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[var(--neo-text-muted)]">
                      {formatWhen(user.createdAt)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[var(--neo-text-muted)]">
                      {formatWhen(user.lastSignInAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setEditingUser(user);
                            setEditRole(user.role);
                            setEditPassword("");
                            setEditConfirmPassword("");
                          }}
                          className="rounded-md border border-violet-500/40 px-3 py-1.5 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/15 disabled:opacity-40"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setDeleteTarget(user)}
                          className="rounded-md border border-[var(--danger)]/40 px-3 py-1.5 text-xs font-semibold text-[var(--danger)] transition hover:bg-[var(--danger)]/10 disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredUsers.length > PAGE_SIZE ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--neo-text-muted)]">
            <span>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredUsers.length)} of{" "}
              {filteredUsers.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || busy}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-[var(--neo-border)] px-3 py-1.5 transition hover:border-[var(--neo-border-focus)] disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || busy}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-[var(--neo-border)] px-3 py-1.5 transition hover:border-[var(--neo-border-focus)] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
