import { redirect } from "next/navigation";

/**
 * Plumber Reset — Phase 3 step 7 (UI transition). This was the
 * standalone manual "New Job Record" path, flagged in the Phase 1
 * audit as a real bug: it created a job_docs row with no link back to
 * a Work Card at all, a second, unreconciled way into the same table.
 * A report is now only ever generated from a real Job
 * (/dashboard/work-cards/[id]'s own "Generate report" action) — there
 * is no standalone way to create one, by design. Kept only as a
 * redirect so an old bookmark or link still lands somewhere real.
 */
export default function NewJobRecordRedirectPage() {
  redirect("/dashboard/work-cards");
}
