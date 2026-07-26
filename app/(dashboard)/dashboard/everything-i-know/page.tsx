import { redirect } from "next/navigation";

/**
 * Retired (V1 First-Run redesign, DOCS/SPECS/ReplyFlow-V1-First-Run-
 * Proposal.md §3, §5). Everything I Know's real job — showing
 * confidence and gaps — was already duplicated inline on both Business
 * and Receptionist ("Where things stand," "How well I know your
 * style"); a separate confidence dashboard is redundant once there's
 * only one teaching surface to have confidence about. Its two
 * genuinely non-duplicated sections (recent-changes timestamps,
 * customer counts) were retired rather than relocated — neither
 * clearly increases confidence or helps run the business (Principle
 * 6), and customer counts belong more naturally on the Customers page
 * if that's ever revisited. Kept only as a redirect so no bookmarked
 * or linked URL 404s.
 */
export default function EverythingIKnowRedirect() {
  redirect("/dashboard/receptionist");
}
