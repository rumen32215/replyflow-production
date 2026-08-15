import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata: Metadata = { title: "Jobs — ReplyFlow" };

/**
 * Plumber Reset — Phase 3 step 7 (UI transition). Every Job, one list,
 * one concept — "Work Card" and "Job Record" no longer exist as
 * separate things a plumber has to reason about (Phase 2 architecture:
 * work_cards stays the canonical table, "Job" is the word the product
 * uses everywhere a plumber sees it). RLS (0013_work_cards.sql) is the
 * real access boundary, same defence-in-depth pattern as every other
 * owner-scoped list in this app.
 */
export default async function WorkCardsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).maybeSingle();
  if (!business) redirect("/onboarding/preparing");

  const { data: workCards } = await supabase
    .from("work_cards")
    .select("id, customer_name, issue, status, scheduled_for, completed_at, created_at, report_status")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  const cards = workCards ?? [];

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Jobs</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">Every job, from first enquiry to completed work.</p>
      </div>

      {cards.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No jobs yet."
          description="A Job is created from a conversation once there's a real enquiry to organise — see Conversations."
        />
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {cards.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/work-cards/${c.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold">{c.customer_name}</p>
                <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{c.issue}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {/* Report status is a separate axis from job status —
                    only ever shown once there's something to say, never
                    implying the job itself is done. */}
                {c.report_status === "approved" && (
                  <span className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">Report approved</span>
                )}
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11.5px] font-semibold capitalize text-muted-foreground">
                  {c.status.replace(/_/g, " ")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
