import { redirect } from "next/navigation";

/**
 * Plumber Reset — Phase 3 step 7 (UI transition). "Job Records" is no
 * longer a separate destination — there is one Job (work_cards), and
 * its report is reached from the Job workspace itself
 * (/dashboard/work-cards/[id]'s own Report section), never a second
 * top-level list a plumber has to separately remember. This route is
 * kept only so an old bookmark or link still lands somewhere real.
 */
export default function JobRecordsRedirectPage() {
  redirect("/dashboard/work-cards");
}
