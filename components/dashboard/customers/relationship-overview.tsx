import { Briefcase, Calendar, MapPin } from "lucide-react";
import { SettleCard } from "@/components/shared/motion";
import type { CustomerJob } from "@/lib/customer-memory-signals";

/**
 * Centre panel, top — the natural-language summary (Feature 12 UI:
 * "the centre panel begins with a natural summary... the owner
 * immediately understands the relationship") followed by memory
 * cards. Feature 12 UI names six possible cards (Your Relationship,
 * Communication Style, Service History, Property Information, Future
 * Opportunities, Preferences) — only three have real, honestly
 * derivable data today (job history and job notes); the rest would
 * require message-content analysis or service-interval knowledge
 * this sprint doesn't build, so they're simply not shown rather than
 * padded with invented content.
 */
export function RelationshipOverview({
  summary,
  completedJobCount,
  jobs,
}: {
  summary: string;
  completedJobCount: number;
  jobs: readonly CustomerJob[];
}) {
  const notes = jobs.filter((j) => j.notes?.trim()).map((j) => ({ jobTitle: j.jobTitle, notes: j.notes as string }));

  return (
    <div className="space-y-4">
      <SettleCard className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-[15px] leading-relaxed">{summary}</p>
      </SettleCard>

      {completedJobCount > 0 && (
        <SettleCard delay={0.05} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[13px] font-bold">Service history</h2>
          </div>
          <div className="space-y-2.5">
            {jobs
              .filter((j) => j.status === "completed")
              .map((j) => (
                <div key={j.id} className="flex items-center justify-between gap-3 text-[13.5px]">
                  <span className="min-w-0 truncate">{j.jobTitle}</span>
                  <span className="shrink-0 flex items-center gap-1 text-[12px] text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {j.completedAt &&
                      new Date(j.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              ))}
          </div>
        </SettleCard>
      )}

      {notes.length > 0 && (
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
        </SettleCard>
      )}
    </div>
  );
}
