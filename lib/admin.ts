/**
 * Master Execution Plan 3.3 — the real, scoped authorization check
 * Security Baseline §5 requires before any web-reachable surface may
 * touch the service-role client: "authenticate its own operator and
 * authorize against a real, scoped check — never simply hold or proxy
 * the service-role key to whoever can reach its URL." A real
 * Supabase-authenticated session (checked by app/admin/layout.tsx
 * before this ever runs) plus this email allowlist together satisfy
 * that — never the allowlist alone, since an email string is not an
 * identity check on its own.
 *
 * Pure and side-effect-free so it's directly unit-testable, matching
 * every other lib/*.ts convention in this codebase.
 */
export function isAdminEmail(email: string | null | undefined, adminEmailsEnv: string | undefined): boolean {
  if (!email) return false;
  const allowlist = (adminEmailsEnv ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.trim().toLowerCase());
}
