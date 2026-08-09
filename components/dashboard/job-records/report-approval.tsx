"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/work-card-format";

export interface ReportApprovalSummary {
  hasJobSummary: boolean;
  hasWorkPerformed: boolean;
  observationCount: number;
  photoCount: number;
}

function SummaryLine({ ready, label }: { ready: boolean; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={ready ? "text-success" : "text-muted-foreground"}>{ready ? "✓" : "–"}</span>
      <span>{label}</span>
    </li>
  );
}

/**
 * ReplyFlow 2.0, Phase 2E — the approval action and status, shown
 * alongside the report preview. The summary here is built entirely
 * from the same content the preview already renders (passed down as
 * plain counts/booleans from app/.../[id]/report/page.tsx's own
 * selectReportContent() call) — never a second fetch or a second
 * content decision.
 */
export function ReportApproval({
  jobDocId,
  status,
  approvedAt,
  summary,
}: {
  jobDocId: string;
  status: string;
  approvedAt: string | null;
  summary: ReportApprovalSummary;
}) {
  const router = useRouter();
  const [approving, setApproving] = useState(false);

  const isApproved = status === "approved";
  const canApprove = status === "review";
  const hasContent =
    summary.hasJobSummary || summary.hasWorkPerformed || summary.observationCount > 0 || summary.photoCount > 0;

  async function approve() {
    if (approving) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/job-docs/${jobDocId}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Something went wrong.");
      toast({ variant: "success", title: "Report approved" });
      router.refresh();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't approve this report",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setApproving(false);
    }
  }

  if (isApproved) {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl border border-success/30 bg-success/[0.06] px-4 py-3.5">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-success">Approved</p>
          <p className="text-[12.5px] text-muted-foreground">
            {approvedAt ? `Approved ${formatDateTime(approvedAt)}` : "This report has been approved."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-2.5">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">Review before approving</p>
          <ul className="mt-1.5 space-y-0.5 text-[12.5px] text-muted-foreground">
            <SummaryLine ready={summary.hasJobSummary} label="Job Summary" />
            <SummaryLine ready={summary.hasWorkPerformed} label="Work Performed" />
            <SummaryLine
              ready={summary.observationCount > 0}
              label={`${summary.observationCount} observation${summary.observationCount === 1 ? "" : "s"}`}
            />
            <SummaryLine ready={summary.photoCount > 0} label={`${summary.photoCount} photo${summary.photoCount === 1 ? "" : "s"}`} />
          </ul>
        </div>
      </div>
      <div className="mt-3">
        <Button variant="success" onClick={approve} disabled={approving || !canApprove || !hasContent} className="w-auto">
          {approving && <Loader2 className="h-4 w-4 animate-spin" />}
          Approve Report
        </Button>
        {!canApprove && (
          <p className="mt-2 text-[12px] text-muted-foreground">
            Generate a draft and make sure it&apos;s ready for review before approving.
          </p>
        )}
        {canApprove && !hasContent && (
          <p className="mt-2 text-[12px] text-muted-foreground">This report doesn&apos;t have any content yet.</p>
        )}
      </div>
    </div>
  );
}
