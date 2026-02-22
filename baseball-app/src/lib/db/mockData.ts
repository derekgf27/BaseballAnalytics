/**
 * Helpers for demo/dummy IDs (e.g. if we ever add optional demo data again).
 * No mock roster or games — app uses only Supabase data.
 */

export function isDemoId(id: string): boolean {
  return id.startsWith("demo-");
}
