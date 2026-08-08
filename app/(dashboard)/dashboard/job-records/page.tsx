import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Job Records — ReplyFlow" };

/**
 * ReplyFlow 2.0, Phase 2 — the list view. RLS (0025_job_docs.sql) is
 * the real access boundary here, same as every other owner-scoped page
 * in this app: this query has no explicit business_id filter beyond
 * what RLS itself already enforces, but an explicit .eq() is included
 * anyway for the same defence-in-depth reason 07-Engineering-
 * Principles.md already applies elsewhere — never rely on RLS as the
 * only place ownership is expressed. Creation now lives on its own
 * page (/dashboard/job-records/new) rather than an inline quick-add —
 * Phase 2's intake form needs more than a title.
 */
export default async function JobRecordsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).maybeSingle();
  if (!business) redirect("/onboarding/preparing");

  const { data: jobDocs } = await supabase
    .from("job_docs")
    .select("id, title, status, created_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  const records = jobDocs ?? [];

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Job Records</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">A record for each job — the foundation the rest of this builds on.</p>
        </div>
        <Button variant="primary" asChild className="w-auto">
          <Link href="/dashboard/job-records/new">
            <Plus className="h-4 w-4" />
            New Job Record
          </Link>
        </Button>
      </div>

      {records.length === 0 ? (
        <EmptyState icon={FileText} title="No job records yet." description="Create your first one above to get started." />
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {records.map((r) => (
            <Link
              key={r.id}
              href={`/dashboard/job-records/${r.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold">{r.title}</p>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11.5px] font-semibold capitalize text-muted-foreground">
                {r.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
