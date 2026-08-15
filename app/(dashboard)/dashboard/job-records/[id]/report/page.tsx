import { redirect } from "next/navigation";

/**
 * Plumber Reset — Phase 3 step 10 (route rename). The report preview/
 * approval page moved to /dashboard/reports/[id]/preview — see the
 * sibling redirect at /dashboard/job-records/[id] for the same reasoning.
 * Kept only as a redirect so an old bookmark or link still lands on the
 * same report, never a 404.
 */
export default function JobRecordReportRedirectPage({ params }: { params: { id: string } }) {
  redirect(`/dashboard/reports/${params.id}/preview`);
}
