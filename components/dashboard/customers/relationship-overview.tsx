"use client";

import { useState } from "react";
import Link from "next/link";
import { Briefcase, Calendar, MapPin, Clock3, PoundSterling } from "lucide-react";
import { SettleCard } from "@/components/shared/motion";
import { CommunicationPreference } from "@/components/dashboard/customers/communication-preference";
import { isActiveWorkCardStatus } from "@/lib/work-card-state";
import type { CustomerJob } from "@/lib/customer-memory-signals";

/** QA2 Phase 7 (2026-08-16) — an unbounded Service History or Notes
 * list was the actual problem a long-time customer's page had: not
 * wrong data, just no hierarchy. Capped to the most recent few with an
 * explicit "View all N" rather than a second page or a new query —
 * same `jobs` array, just not all of it rendered at once by default. */
const SERVICE_HISTORY_CAP = 3;
const NOTES_CAP = 3;

/**
 * Centre panel, top — the natural-language summary (Feature 12 UI:
 * "the centre panel begins with a natural summary... the owner
 * immediately understands the relationship") followed by memory
 * cards. Feature 12 UI names six possible cards (Your Relationship,
 * Communication Style, Service History, Property Information, Future
 * Opportunities, Preferences) — Master Execution Plan 2.3 adds two
 * more that now have real, honestly derivable data (Outstanding work,
 * Previous quotations, both sourced from the same real Work Cards
 * already fetched here) plus a real communication-preference field.
 * The rest would still require message-content analysis or
 * service-interval knowledge this product doesn't build, so they stay
 * simply not shown rather than padded with invented content.
 */
export function RelationshipOverview({
  summary,
  completedJobCount,
  jobs,
  conversationId,
  communicationPreference,
}: {
  summary: string;
  completedJobCount: number;
  jobs: readonly CustomerJob[];
  conversationId: string;
  communicationPreference: string | null;
}) {
  const notesAll = jobs.filter((j) => j.notes?.trim()).map((j) => ({ jobTitle: j.jobTitle, notes: j.notes as string }));
  const outstanding = jobs.filter((j) => isActiveWorkCardStatus(j.status));
  const quotations = jobs.filter((j) => j.estimatedValue != null);
  // Most-recent-first — `jobs` itself is ordered oldest-first (the
  // page's own created_at-ascending query), which reads backwards for
  // a "recent service" card.
  const completedJobsAll = jobs
    .filter((j) => j.status === "completed" && j.completedAt)
    .slice()
    .sort((a, b) => new Date(b.completedAt as string).getTime() - new Date(a.completedAt as string).getTime());

  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const completedJobs = showAllHistory ? completedJobsAll : completedJobsAll.slice(0, SERVICE_HISTORY_CAP);
  const notes = showAllNotes ? notesAll : notesAll.slice(0, NOTES_CAP);

  return (
    <div className="space-y-4">
      <SettleCard className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-[15px] leading-relaxed">{summary}</p>
        <CommunicationPreference conversationId={conversationId} initial={communicationPreference} />
      </SettleCard>

      {outstanding.length > 0 && (
        <SettleCard delay={0.03} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[13px] font-bold">Outstanding work</h2>
          </div>
          <div className="space-y-2.5">
            {outstanding.map((j) => (
              <Link
                key={j.id}
                href={`/dashboard/work-cards/${j.id}`}
                className="flex items-center justify-between gap-3 text-[13.5px] hover:text-primary"
              >
                <span className="min-w-0 truncate">{j.jobTitle}</span>
                <span className="shrink-0 text-[12px] text-muted-foreground">
                  since {new Date(j.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              </Link>
            ))}
          </div>
        </SettleCard>
      )}

      {completedJobCount > 0 && (
        <SettleCard delay={0.05} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[13px] font-bold">Service history</h2>
          </div>
          <div className="space-y-3">
            {completedJobs.map((j) => (
              <Link key={j.id} href={`/dashboard/work-cards/${j.id}`} className="block text-[13.5px] hover:text-primary">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">{j.jobTitle}</span>
                  <span className="shrink-0 flex items-center gap-2 text-[12px] text-muted-foreground">
                    {j.estimatedValue != null && <span className="font-semibold text-foreground">£{j.estimatedValue.toFixed(2)}</span>}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {j.completedAt &&
                        new Date(j.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </span>
                </div>
                {j.notes?.trim() && <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{j.notes}</p>}
              </Link>
            ))}
          </div>
          {completedJobsAll.length > SERVICE_HISTORY_CAP && (
            <button
              onClick={() => setShowAllHistory((v) => !v)}
              className="mt-3 text-[12.5px] font-semibold text-primary hover:underline"
            >
              {showAllHistory ? "Show less" : `View all ${completedJobsAll.length}`}
            </button>
          )}
        </SettleCard>
      )}

      {quotations.length > 0 && (
        <SettleCard delay={0.07} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <PoundSterling className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[13px] font-bold">Previous quotations</h2>
          </div>
          <div className="space-y-2.5">
            {quotations.map((j) => (
              <Link
                key={j.id}
                href={`/dashboard/work-cards/${j.id}`}
                className="flex items-center justify-between gap-3 text-[13.5px] hover:text-primary"
              >
                <span className="min-w-0 truncate">{j.jobTitle}</span>
                <span className="shrink-0 font-semibold">£{j.estimatedValue?.toFixed(2)}</span>
              </Link>
            ))}
          </div>
        </SettleCard>
      )}

      {notesAll.length > 0 && (
        <SettleCard delay={0.09} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[13px] font-bold">Notes from past jobs</h2>
          </div>
          <div className="space-y-3">
            {notes.map((n, i) => (
              <div key={i}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{n.jobTitle}</p>
                <p className="mt-0.5 text-[13.5px] leading-relaxed text-foreground">{n.notes}</p>
              </div>
            ))}
          </div>
          {notesAll.length > NOTES_CAP && (
            <button onClick={() => setShowAllNotes((v) => !v)} className="mt-3 text-[12.5px] font-semibold text-primary hover:underline">
              {showAllNotes ? "Show less" : `View all ${notesAll.length}`}
            </button>
          )}
        </SettleCard>
      )}
    </div>
  );
}
