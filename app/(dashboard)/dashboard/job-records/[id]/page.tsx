import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { JobReportDraft, type DraftFieldData } from "@/components/dashboard/job-records/job-report-draft";
import {
  RAW_NOTES_FIELD_KEY,
  JOB_SUMMARY_FIELD_KEY,
  WORK_PERFORMED_FIELD_KEY,
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
    .select("id, title, status, customer_name, customer_phone, customer_email, job_address, job_date, created_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!jobDoc) notFound();

  const { data: fields } = await supabase
    .from("job_doc_fields")
    .select("id, job_doc_id, section_label, sort_order, field_key, field_value, provenance, confidence, updated_by")
    .eq("job_doc_id", jobDoc.id)
    .order("sort_order", { ascending: true });

  const allFields = (fields ?? []) as JobDocFieldRow[];
  const rawNotes = allFields.find((f) => f.field_key === RAW_NOTES_FIELD_KEY)?.field_value ?? "";
  const jobSummary = toDraftField(allFields.find((f) => f.field_key === JOB_SUMMARY_FIELD_KEY));
  const workPerformed = toDraftField(allFields.find((f) => f.field_key === WORK_PERFORMED_FIELD_KEY));
  const observations = allFields
    .filter((f) => isObservationFieldKey(f.field_key))
    .map((f) => toDraftField(f))
    .filter((f): f is DraftFieldData => f !== null);

  return (
    <div className="mx-auto max-w-[760px] space-y-6">
      <div>
        <Link href="/dashboard/job-records" className="inline-flex items-center gap-1 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" />
          Job Records
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight">{jobDoc.title}</h1>
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11.5px] font-semibold capitalize text-muted-foreground">{jobDoc.status}</span>
        </div>
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

      {rawNotes && (
        <section className="rounded-2xl border border-border bg-muted/40 p-5">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground">Original Notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground">{rawNotes}</p>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">Job Report</h2>
        <JobReportDraft jobDocId={jobDoc.id} jobSummary={jobSummary} workPerformed={workPerformed} observations={observations} />
      </section>
    </div>
  );
}
