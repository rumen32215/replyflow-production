import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { JobReportDraft, type DraftFieldData } from "@/components/dashboard/job-records/job-report-draft";
import { PhotoSection } from "@/components/dashboard/job-records/photo-section";
import type { JobDocPhoto } from "@/hooks/use-job-doc-photos";
import { JOB_DOC_MEDIA_BUCKET } from "@/lib/job-docs/photo-storage";
import { ANALYSIS_ERROR_MARKER } from "@/lib/job-docs/photo-schema";
import { cn } from "@/lib/utils";
import {
  RAW_NOTES_FIELD_KEY,
  JOB_SUMMARY_FIELD_KEY,
  WORK_PERFORMED_FIELD_KEY,
  NEXT_STEPS_FIELD_KEY,
  DIVERGENCE_NOTE_FIELD_KEY,
  isObservationFieldKey,
  type JobDocFieldRow,
} from "@/lib/job-docs/fields";

export const metadata: Metadata = { title: "Job Record — ReplyFlow" };

function toDraftField(row: JobDocFieldRow | undefined): DraftFieldData | null {
  if (!row) return null;
  return { key: row.field_key, value: row.field_value ?? "", provenance: row.provenance };
}

export default async function JobRecordDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS (0025_job_docs.sql) scopes this to the signed-in owner's business.
  const { data: jobDoc } = await supabase
    .from("job_docs")
    .select("id, title, status, customer_name, customer_phone, customer_email, job_address, job_date, created_at, work_card_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!jobDoc) notFound();

  // Production hardening (2026-08-14) — the real Work Card status/issue,
  // live-fetched via the existing link, never a stored copy on job_docs.
  // "Issue Reported" is the customer's actual original issue (already
  // exists on work_cards), not a new AI-generated or stored field.
  const { data: workCard } = jobDoc.work_card_id
    ? await supabase.from("work_cards").select("status, issue").eq("id", jobDoc.work_card_id).maybeSingle()
    : { data: null };
  const isJobCompleted = workCard?.status === "completed";
  const issueReported = workCard?.issue ?? null;

  const { data: fields } = await supabase
    .from("job_doc_fields")
    .select("id, job_doc_id, section_label, sort_order, field_key, field_value, provenance, confidence, updated_by")
    .eq("job_doc_id", jobDoc.id)
    .order("sort_order", { ascending: true });

  const allFields = (fields ?? []) as JobDocFieldRow[];
  const rawNotes = allFields.find((f) => f.field_key === RAW_NOTES_FIELD_KEY)?.field_value ?? "";
  const jobSummary = toDraftField(allFields.find((f) => f.field_key === JOB_SUMMARY_FIELD_KEY));
  const workPerformed = toDraftField(allFields.find((f) => f.field_key === WORK_PERFORMED_FIELD_KEY));
  const nextSteps = toDraftField(allFields.find((f) => f.field_key === NEXT_STEPS_FIELD_KEY));
  const divergenceNote = allFields.find((f) => f.field_key === DIVERGENCE_NOTE_FIELD_KEY)?.field_value ?? null;
  const observations = allFields
    .filter((f) => isObservationFieldKey(f.field_key))
    .map((f) => toDraftField(f))
    .filter((f): f is DraftFieldData => f !== null);

  // Photos (ReplyFlow 2.0, Phase 2A) — RLS already scopes the read to
  // this owner's business; the service role is only needed afterward,
  // for signed URLs into the private job-doc-media bucket. Same
  // pattern already used for WhatsApp photos in
  // app/(dashboard)/dashboard/conversations/[id]/page.tsx.
  const { data: photoRows } = await supabase
    .from("job_doc_photos")
    .select("id, storage_path, caption, phase, sort_order, visible_summary, possible_summary, unknown_note, analysis_confidence, analyzed_at")
    .eq("job_doc_id", jobDoc.id)
    .order("sort_order", { ascending: true });

  const rows = photoRows ?? [];
  const service = createServiceClient();
  const signedResults = rows.length
    ? await Promise.all(rows.map((r) => service.storage.from(JOB_DOC_MEDIA_BUCKET).createSignedUrl(r.storage_path, 3600)))
    : [];
  const initialPhotos: JobDocPhoto[] = rows.map((r, i) => {
    const analysisErrored = r.unknown_note === ANALYSIS_ERROR_MARKER;
    return {
      id: r.id,
      url: signedResults[i]?.data?.signedUrl ?? null,
      caption: r.caption,
      phase: r.phase,
      sortOrder: r.sort_order,
      visibleSummary: r.visible_summary ?? "",
      possibleSummary: r.possible_summary ?? "",
      unknownNote: analysisErrored ? "" : r.unknown_note ?? "",
      analysisErrored,
      confidence: r.analysis_confidence,
      analyzedAt: r.analyzed_at,
    };
  });

  return (
    <div className="mx-auto max-w-[760px] space-y-6">
      <div>
        <Link href="/dashboard/job-records" className="inline-flex items-center gap-1 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" />
          Job Records
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight">{jobDoc.title}</h1>
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/job-records/${jobDoc.id}/report`}
              className="rounded-full border border-border bg-card px-3 py-1 text-[11.5px] font-semibold text-foreground hover:bg-muted"
            >
              {/* Production hardening (2026-08-14) — same destination
               * either way (the report/approval/download page); the
               * label just tells the truth about what's there. */}
              {jobDoc.status === "approved" ? "View Approved Report" : "Preview Report"}
            </Link>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold capitalize",
                jobDoc.status === "approved" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
              )}
            >
              {jobDoc.status}
            </span>
          </div>
        </div>
        {/* Production hardening (2026-08-14) — the real Work Card status,
         * so the owner understands why Work Performed may be locked to
         * "in progress" below, rather than it looking broken or blank
         * for no reason. Read-only here — job completion is only ever
         * changed from the Work Card itself. */}
        {jobDoc.work_card_id && (
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            Job status:{" "}
            <span className={cn("font-semibold", isJobCompleted ? "text-success" : "text-attention")}>
              {isJobCompleted ? "Completed" : "In progress"}
            </span>
          </p>
        )}
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground">Customer &amp; Property</h2>
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="text-[11.5px] text-muted-foreground">Customer</dt>
            <dd className="text-[14px] font-medium">{jobDoc.customer_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-[11.5px] text-muted-foreground">Address</dt>
            <dd className="text-[14px] font-medium">{jobDoc.job_address || "—"}</dd>
          </div>
          <div>
            <dt className="text-[11.5px] text-muted-foreground">Phone</dt>
            <dd className="text-[14px] font-medium">{jobDoc.customer_phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-[11.5px] text-muted-foreground">Email</dt>
            <dd className="text-[14px] font-medium">{jobDoc.customer_email || "—"}</dd>
          </div>
          <div>
            <dt className="text-[11.5px] text-muted-foreground">Job date</dt>
            <dd className="text-[14px] font-medium">
              {jobDoc.job_date ? new Date(jobDoc.job_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
            </dd>
          </div>
        </dl>
      </section>

      {/* Production hardening (2026-08-14) — the customer's actual
       * original issue, straight from the linked Work Card (work_cards
       * .issue), not a new stored/AI field — this is what "Issue
       * Reported" means on the final report too. */}
      {issueReported && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground">Issue Reported</h2>
          <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground">{issueReported}</p>
        </section>
      )}

      {rawNotes && (
        <section className="rounded-2xl border border-border bg-muted/40 p-5">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground">Original Notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground">{rawNotes}</p>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5">
        {/* Production hardening (2026-08-14) — a real bug found in live
         * testing: navigating between two different Job Records without
         * a full page reload could leave this component's own local
         * photo state (useJobDocPhotos) un-reset, since React reuses a
         * component instance at the same tree position across a prop
         * change alone. `key={jobDoc.id}` forces a genuine remount per
         * record, so a new job always starts from its own fresh
         * initialPhotos — the previous job's photos can never bleed
         * into or duplicate onto this one. */}
        <PhotoSection key={jobDoc.id} jobDocId={jobDoc.id} initialPhotos={initialPhotos} />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">Job Report</h2>
        {/* Same remount-on-navigation fix as PhotoSection above — this
         * editor's own local draft-field state must never carry over
         * from a previously-viewed Job Record either. */}
        <JobReportDraft
          key={jobDoc.id}
          jobDocId={jobDoc.id}
          jobSummary={jobSummary}
          workPerformed={workPerformed}
          nextSteps={nextSteps}
          observations={observations}
          divergenceNote={divergenceNote}
          hasPhotos={initialPhotos.length > 0}
          isJobCompleted={isJobCompleted}
          hasLinkedWorkCard={Boolean(jobDoc.work_card_id)}
        />
      </section>
    </div>
  );
}
