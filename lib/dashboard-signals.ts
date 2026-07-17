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

export interface PresenceLineInput {
  isNewBusiness: boolean;
  waitingCount: number;
  waitingCustomer: { name: string; minutes: number } | null;
  jobsBookedToday: number;
}

/**
 * Her one honest sentence about right now, for the Front Desk presence
 * header. Same deterministic, real-facts-only assembly as
 * buildMorningBrief above — first person, and time-of-day independent
 * (the page can be opened any time, not only in the morning), so it
 * never claims something that isn't true.
 */
export function buildPresenceLine({
  isNewBusiness,
  waitingCount,
  waitingCustomer,
  jobsBookedToday,
}: PresenceLineInput): string {
  if (isNewBusiness) {
    return "I'm ready for your first customer.";
  }

  if (waitingCustomer) {
    const suffix = waitingCount > 1 ? ` (plus ${waitingCount - 1} more)` : "";
    return `${waitingCustomer.name} has been waiting ${formatWaitingTime(waitingCustomer.minutes)}${suffix}, so I'd start there.`;
  }

  if (jobsBookedToday > 0) {
    return `Everything's handled — ${jobsBookedToday} ${jobsBookedToday === 1 ? "job" : "jobs"} booked in today.`;
  }

  return "Everything's quiet — I'll let you know the moment someone gets in touch.";
}

/**
 * When there's genuinely nothing pressing, her presence line gently
 * rotates through a few honest, calming variants instead of sitting
 * static — proof she's actively watching, not idle. Only ever used
 * for the calm state: a real waiting customer or a real booked job
 * always overrides this with the specific fact (see buildPresenceLine)
 * — rotation never gets to obscure something true. The WhatsApp line
 * only appears when the connection is actually live.
 */
export function calmStatusMessages(whatsappConnected: boolean): readonly string[] {
  const base = [
    "Everything's quiet — I'll let you know the moment someone gets in touch.",
    "Inbox checked. Nothing needs you right now.",
    "Watching for new enquiries.",
    "Ready for your next customer.",
    "Everything looks good.",
  ] as const;
  return whatsappConnected ? [...base, "WhatsApp connection is steady."] : base;
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
