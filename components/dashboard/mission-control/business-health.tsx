import { Briefcase, CalendarCheck, ClipboardCheck } from "lucide-react";
import { SettleCard } from "@/components/shared/motion";

/**
 * Deliberately NOT a reuse of Front Desk's BusinessHealth component —
 * that shows jobsToday/completedToday/waitingCount, all three already
 * shown in Operational Overview above. Reusing it verbatim here would
 * just repeat the same three numbers under a different heading, which
 * is the "vanity metric" the spec explicitly warns against. Instead
 * this shows where operational work currently sits — three counts not
 * shown as standalone numbers anywhere else on the page.
 */
export interface MissionControlHealthMetrics {
  awaitingApproval: number;
  beingHandled: number;
  bookedIn: number;
}

export function MissionControlBusinessHealth({ awaitingApproval, beingHandled, bookedIn }: MissionControlHealthMetrics) {
  if (awaitingApproval === 0 && beingHandled === 0 && bookedIn === 0) return null;

  const metrics = [
    { icon: ClipboardCheck, label: "Awaiting your approval", value: awaitingApproval },
    { icon: Briefcase, label: "Being handled", value: beingHandled },
    { icon: CalendarCheck, label: "Booked in", value: bookedIn },
  ];

  return (
    <SettleCard delay={0.21} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Business health</h2>
      <div className="grid grid-cols-3 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl bg-muted/30 p-3.5 text-center">
            <m.icon className="mx-auto h-4 w-4 text-muted-foreground" />
            <p className="mt-2 text-[18px] font-extrabold tracking-tight">{m.value}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{m.label}</p>
          </div>
        ))}
      </div>
    </SettleCard>
  );
}
