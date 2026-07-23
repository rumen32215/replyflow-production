import { redirect } from "next/navigation";

/**
 * Mission Control (Owner Experience 01) — retired as a separate page.
 * Its real content (the operational board: urgent work, today's jobs,
 * waiting customers, activity feed) is now Front Desk itself
 * (app/(dashboard)/dashboard/page.tsx) — having two independently-
 * queried "what needs attention" boards, one calm and one broad, was
 * the real duplication this sprint removed. This redirect exists only
 * so a bookmarked or cached link to /dashboard/mission-control still
 * lands somewhere real, never a 404.
 */
export default function MissionControlRedirect() {
  redirect("/dashboard");
}
