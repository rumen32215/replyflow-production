import type { LucideIcon } from "lucide-react";
import { MessagesSquare, Camera, CheckCircle2, CalendarCheck, AlertCircle } from "lucide-react";

export interface OvernightLine {
  icon: LucideIcon;
  tone: "default" | "success" | "attention";
  text: string;
}

/** Builds only the lines that are actually true — a permanent home for
 * "0 of everything" does not exist in this component. Called from
 * page.tsx once counts are known. */
export function buildOvernightLines(counts: {
  newEnquiries: number;
  photos: number;
  quotesAccepted: number;
  jobsBooked: number;
  needsReply: number;
}): OvernightLine[] {
  const lines: OvernightLine[] = [];

  if (counts.newEnquiries > 0) {
    lines.push({
      icon: MessagesSquare,
      tone: "default",
      text: `ReplyFlow looked after ${counts.newEnquiries} new ${counts.newEnquiries === 1 ? "enquiry" : "enquiries"}`,
    });
  }
  if (counts.photos > 0) {
    lines.push({
      icon: Camera,
      tone: "default",
      text: `${counts.photos} ${counts.photos === 1 ? "customer" : "customers"} sent photos`,
    });
  }
  if (counts.quotesAccepted > 0) {
    lines.push({
      icon: CheckCircle2,
      tone: "success",
      text: `${counts.quotesAccepted} ${counts.quotesAccepted === 1 ? "quote was" : "quotes were"} accepted`,
    });
  }
  if (counts.jobsBooked > 0) {
    lines.push({
      icon: CalendarCheck,
      tone: "success",
      text: `${counts.jobsBooked} ${counts.jobsBooked === 1 ? "job" : "jobs"} booked in`,
    });
  }
  if (counts.needsReply > 0) {
    lines.push({
      icon: AlertCircle,
      tone: "attention",
      text: `${counts.needsReply} ${counts.needsReply === 1 ? "customer" : "customers"} still ${counts.needsReply === 1 ? "needs" : "need"} your reply`,
    });
  }

  return lines;
}

export function BeforeYouArrived({ lines }: { lines: OvernightLine[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="mb-4 text-[15px] font-bold tracking-tight">Before you arrived</h2>

      {lines.length === 0 ? (
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          Nothing came in overnight — you&apos;re starting fresh.
        </p>
      ) : (
        <ul className="space-y-3">
          {lines.map((line, i) => (
            <li key={i} className="flex items-center gap-3">
              <span
                className={
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full " +
                  (line.tone === "success"
                    ? "bg-success/10 text-success"
                    : line.tone === "attention"
                    ? "bg-amber-500/10 text-amber-600"
                    : "bg-accent text-primary")
                }
              >
                <line.icon className="h-4 w-4" />
              </span>
              <span className="text-[14px] leading-relaxed">{line.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
