/**
 * Optional comma-separated emails in ALLOWED_EMAILS (e.g. you@team.com,friend@team.com).
 * If empty, any authenticated Supabase user may access the app.
 */
export function isEmailAllowed(email: string | undefined): boolean {
  const raw = process.env.ALLOWED_EMAILS;
  if (!raw?.trim()) return true;
  if (!email) return false;
  const allowed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
