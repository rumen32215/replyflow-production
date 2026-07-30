import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

/**
 * Master Execution Plan 3.3 — the real, scoped authorization gate
 * Security Baseline §5 requires before any internal tool touches the
 * service-role client: a genuine Supabase-authenticated session (never
 * bypassable — middleware.ts already redirects an unauthenticated
 * visitor to /login before this even runs) checked against a real
 * admin allowlist. A non-admin authenticated owner (any real customer)
 * is bounced back to their own dashboard, not shown an error page that
 * confirms /admin exists at all.
 *
 * Deliberately its own route tree, not nested under (dashboard) — this
 * is not the customer product, and should never visually or
 * structurally resemble it.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!isAdminEmail(user.email, process.env.ADMIN_EMAILS)) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900 px-6 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-5">
            <Link href="/admin" className="text-[14px] font-bold tracking-tight">
              ReplyFlow Admin
            </Link>
            <Link href="/admin/metrics" className="text-[12.5px] text-slate-400 hover:text-slate-200">
              Metrics
            </Link>
          </div>
          <div className="flex items-center gap-4 text-[12.5px] text-slate-400">
            <span>{user.email}</span>
            <Link href="/dashboard" className="hover:text-slate-200">
              Back to my dashboard
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
