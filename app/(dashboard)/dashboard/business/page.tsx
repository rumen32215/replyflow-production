import { redirect } from "next/navigation";

/**
 * Retired (V1 First-Run redesign, DOCS/SPECS/ReplyFlow-V1-First-Run-
 * Proposal.md §3). Business Profile is no longer its own destination —
 * it's rendered inline on "Teach your receptionist"
 * (/dashboard/receptionist), directly below the Receptionist section,
 * as one continuous teaching surface rather than a separate page.
 * Forwards ?topic= so existing deep links (Recommendations, Front
 * Desk) still land on the right field.
 */
export default function BusinessPageRedirect({ searchParams }: { searchParams: { topic?: string } }) {
  const topic = searchParams.topic;
  redirect(topic ? `/dashboard/receptionist?topic=${encodeURIComponent(topic)}` : "/dashboard/receptionist");
}
