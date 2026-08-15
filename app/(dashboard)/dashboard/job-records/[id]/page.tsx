import { redirect } from "next/navigation";

/**
 * Plumber Reset — Phase 3 step 10 (route rename). The report editor
 * moved to /dashboard/reports/[id] — "job-records" named a separate
 * entity that no longer exists, "reports" names what this page
 * actually is. Kept only as a redirect so an old bookmark or link
 * still lands on the same report, never a 404.
 */
export default function JobRecordEditorRedirectPage({ params }: { params: { id: string } }) {
  redirect(`/dashboard/reports/${params.id}`);
}
