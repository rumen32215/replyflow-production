/**
 * Pure functions only — no Supabase, no React. Dashboard V2's page.tsx
 * fetches real data and calls these to turn it into display-ready
 * values. Kept separate so the "what does this number mean" logic is
 * testable and reviewable in one place, not scattered through JSX.
 */

export function minutesSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

/** "18 minutes" / "1 hour" / "1 hour 12 minutes" — never decimal, never
 * "0 hours 5 minutes." */
export function formatWaitingTime(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  const hourPart = `${hours} hour${hours === 1 ? "" : "s"}`;
  return remainder === 0 ? hourPart : `${hourPart} ${remainder} minute${remainder === 1 ? "" : "s"}`;
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(amount);
}

export interface MorningBriefInput {
  enquiriesToday: number;
  jobsBookedToday: number;
  waitingCustomer: { name: string; minutes: number } | null;
}

/**
 * Deterministic sentence assembly — the same pattern already proven on
 * the AI Receptionist preview (buildPreviewReply): real facts slotted
 * into a small number of pre-written shapes, never a live AI call.
 * Every branch only fires when its underlying fact is true, so this
 * can never claim something happened that didn't.
 */
export function buildMorningBrief({ enquiriesToday, jobsBookedToday, waitingCustomer }: MorningBriefInput): string {
  if (enquiriesToday === 0 && !waitingCustomer) {
    return "Good morning. Everything's quiet so far — you're ready when the first enquiry comes in.";
  }

  const parts: string[] = ["Good morning."];

  if (enquiriesToday > 0) {
    parts.push(`ReplyFlow has looked after ${enquiriesToday} ${enquiriesToday === 1 ? "enquiry" : "enquiries"} so far today.`);
  }

  if (jobsBookedToday > 0) {
    parts.push(`${jobsBookedToday} ${jobsBookedToday === 1 ? "job's" : "jobs are"} booked in.`);
  }

  if (waitingCustomer) {
    parts.push(
      `${waitingCustomer.name} has been waiting ${formatWaitingTime(waitingCustomer.minutes)}, so I'd reply to them first.`
    );
  } else if (enquiriesToday > 0) {
    parts.push("Everything else is under control.");
  }

  return parts.join(" ");
}

/** Estimated, not measured — always presented with the word "estimated"
 * attached wherever it's rendered, never as a bare precise figure. */
export function estimateMinutesSaved(enquiriesToday: number): number {
  return enquiriesToday * 5;
}

export function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
  const hours = Math.floor(totalMinutes / 60);
  const remainder = totalMinutes % 60;
  return remainder === 0 ? `${hours} hour${hours === 1 ? "" : "s"}` : `${hours} hour${hours === 1 ? "" : "s"} ${remainder} minute${remainder === 1 ? "" : "s"}`;
}
