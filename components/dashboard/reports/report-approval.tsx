"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, ShieldCheck, ChevronLeft } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/work-card-format";
import { ReportDownloadButton } from "./report-preview";
import type { ReportDocumentModel } from "@/lib/job-docs/report-document-model";
import { cn } from "@/lib/utils";

export interface ReportApprovalSummary {
  hasJobSummary: boolean;
  hasWorkPerformed: boolean;
  observationCount: number;
  photoCount: number;
  /** Production hardening (2026-08-14) — so this checklist can read
   * "Work Completed — job in progress" instead of a bare "–", which
   * would otherwise look like a missing/broken field rather than a
   * correct, deliberate absence. */
  isJobCompleted: boolean;
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
  model,
  fileName,
}: {
  jobDocId: string;
  status: string;
  approvedAt: string | null;
  summary: ReportApprovalSummary;
  /** Production hardening (2026-08-14) — the same already-built
   * ReportDocumentModel the preview above renders from, passed down so
   * the approved state's Download PDF button produces the identical
   * document, never a second representation. */
  model: ReportDocumentModel;
  fileName: string;
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
      <div className="rounded-2xl border border-success/30 bg-success/[0.06] p-4">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-success">Approved</p>
            <p className="text-[12.5px] text-muted-foreground">
              {approvedAt ? `Approved ${formatDateTime(approvedAt)}` : "This report has been approved."}
            </p>
          </div>
        </div>
        {/* Production hardening (2026-08-14) — this used to be a dead
         * end: approval saved correctly, but nothing told the owner
         * what to do next. Download PDF is the primary action (the
         * actual customer-facing file, not just this preview); Back to
         * Report is the only secondary one — deliberately not
         * overloaded with more choices than that. Share Report is
         * intentionally not built in this pass (job_doc_shares is
         * still schema-only foundation, never written to anywhere). */}
        <div className="mt-3.5 flex flex-wrap gap-2">
          <ReportDownloadButton model={model} fileName={fileName} variant="success" />
          <Link href={`/dashboard/reports/${jobDocId}`} className={cn(buttonVariants({ variant: "outline" }), "w-auto")}>
            <ChevronLeft className="h-4 w-4" />
            Back to Report
          </Link>
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
            <SummaryLine
              ready={summary.isJobCompleted ? summary.hasWorkPerformed : true}
              label={summary.isJobCompleted ? "Work Completed" : "Work Completed — job in progress"}
            />
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
