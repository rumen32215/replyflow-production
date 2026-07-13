import Link from "next/link";
import { MessageCircle, Sparkles, AlertCircle, CalendarCheck2, PartyPopper, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatWaitingTime } from "@/lib/dashboard-signals";

export type FocusState =
  | { kind: "connect-whatsapp" }
  | { kind: "finish-setup" }
  | { kind: "waiting-customer"; name: string; minutes: number; conversationId: string }
  | { kind: "schedule-job"; name: string; jobTitle: string }
  | { kind: "all-good" };

/** One priority wins — first true condition in this order, computed in
 * page.tsx from real data. Never more than one focus item at a time;
 * that's what keeps this readable in five seconds. */
export function pickFocus(input: {
  whatsappConnected: boolean;
  aiConfigured: boolean;
  oldestWaiting: { name: string; minutes: number; conversationId: string } | null;
  pendingBooking: { name: string; jobTitle: string } | null;
  waitingThresholdMinutes: number;
}): FocusState {
  if (!input.whatsappConnected) return { kind: "connect-whatsapp" };
  if (!input.aiConfigured) return { kind: "finish-setup" };
  if (input.oldestWaiting && input.oldestWaiting.minutes >= input.waitingThresholdMinutes) {
    return { kind: "waiting-customer", ...input.oldestWaiting };
  }
  if (input.pendingBooking) return { kind: "schedule-job", ...input.pendingBooking };
  return { kind: "all-good" };
}

export function TodaysFocus({ focus }: { focus: FocusState }) {
  const content = (() => {
    switch (focus.kind) {
      case "connect-whatsapp":
        return {
          icon: MessageCircle,
          heading: "Connect WhatsApp to get started",
          body: "ReplyFlow can't look after enquiries until your WhatsApp Business number is connected.",
          ctaLabel: "Connect WhatsApp",
          href: "/dashboard/whatsapp",
        };
      case "finish-setup":
        return {
          icon: Sparkles,
          heading: "One more minute to finish setup",
          body: "ReplyFlow just needs a little training before it can start replying like part of the team.",
          ctaLabel: "Finish setup",
          href: "/dashboard/ai-receptionist",
        };
      case "waiting-customer":
        return {
          icon: AlertCircle,
          heading: `${focus.name} has been waiting ${formatWaitingTime(focus.minutes)}`,
          body: "Everything else can wait — this one's been sitting the longest.",
          ctaLabel: "Reply now",
          href: `/dashboard/conversations/${focus.conversationId}`,
        };
      case "schedule-job":
        return {
          icon: CalendarCheck2,
          heading: `${focus.name} accepted your quote`,
          body: `${focus.jobTitle} is ready to book in — get it on the calendar while it's fresh.`,
          ctaLabel: "View job",
          href: "/dashboard/conversations",
        };
      case "all-good":
        return {
          icon: PartyPopper,
          heading: "Everything's under control",
          body: "No enquiries waiting and nothing needs booking in right now. Enjoy the quiet.",
          ctaLabel: null,
          href: null,
        };
    }
  })();

  const Icon = content.icon;

  return (
    <section className="rounded-3xl border border-border bg-card p-8 shadow-elevated sm:p-10">
      <p className="mb-5 text-[12.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        Your first job today
      </p>

      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="mb-1.5 text-[22px] font-extrabold leading-tight tracking-tight sm:text-[24px]">
              {content.heading}
            </h2>
            <p className="max-w-lg text-[14.5px] leading-relaxed text-muted-foreground">{content.body}</p>
          </div>
        </div>

        {content.ctaLabel && content.href && (
          <Link href={content.href} className="w-full shrink-0 sm:w-auto">
            <Button variant="primary" size="lg" className="w-full sm:w-auto">
              {content.ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>
    </section>
  );
}
