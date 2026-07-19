"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, CalendarClock, Headset, MessagesSquare, Smartphone } from "lucide-react";
import { press, ScrollReveal } from "@/components/shared/motion";
import { Acknowledgement, ACK, useAcknowledgement } from "@/components/shared/acknowledgement";
import { SwitchVisual } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { toDateString, type Availability } from "@/lib/availability";
import { cn } from "@/lib/utils";

/**
 * Section 9 — Quick Actions (Feature 01 rebuild). Spec: "maximum four
 * buttons... large... simple... icons above labels." Only real,
 * already-built destinations — no Mission Control link, since that
 * feature doesn't exist yet (Conversations is today's closest real
 * equivalent). The "fully booked today" toggle is a small, occasional
 * utility, not one of the four actions, so it sits beneath them at
 * lower visual weight — same debounced, no-Save-button persistence as
 * before, just relocated out of what used to be a single "fast lane"
 * panel and into its own Quick Actions section.
 */

interface QuickActionsProps {
  businessId: string;
  initialAvailability: Availability;
}

const ACTIONS = [
  { href: "/dashboard/receptionist", icon: Headset, label: "Receptionist" },
  { href: "/dashboard/availability", icon: CalendarClock, label: "Diary" },
  { href: "/dashboard/business", icon: BookOpen, label: "Teach me" },
  { href: "/dashboard/conversations", icon: MessagesSquare, label: "Conversations" },
] as const;

export function QuickActions({ businessId, initialAvailability }: QuickActionsProps) {
  const supabase = createClient();
  const { message, isError, isSaving, startSaving, acknowledge, softError } = useAcknowledgement();
  const [availability, setAvailability] = useState(initialAvailability);
  const firstRender = useRef(true);
  const requestId = useRef(0);

  /* Quiet persistence — debounced, never a Save button (unchanged from
   * before this section was rebuilt). */
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(async () => {
      const thisRequest = ++requestId.current;
      startSaving();
      try {
        const { error } = await supabase.from("businesses").update({ availability }).eq("id", businessId);
        if (thisRequest !== requestId.current) return;
        if (error) softError();
        else acknowledge(ACK.diary);
      } catch {
        if (thisRequest === requestId.current) softError();
      }
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability]);

  const today = toDateString(new Date());
  const fullyBooked = availability.fullyBooked.includes(today);

  function toggleFullyBooked() {
    setAvailability((a) => ({
      ...a,
      fullyBooked: a.fullyBooked.includes(today)
        ? a.fullyBooked.filter((d) => d !== today)
        : [...a.fullyBooked, today],
    }));
  }

  return (
    <ScrollReveal className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Quick actions</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ACTIONS.map((action, i) => (
          // Sprint 7.7: scroll-triggered like the card around it, not
          // mount-triggered — a mount-based stagger here would already
          // have finished (invisibly, while the card's own opacity was
          // still 0) by the time anyone scrolls down to see it.
          <ScrollReveal key={action.href} delay={0.05 * i}>
            <QuickActionButton href={action.href} icon={<action.icon className="h-5 w-5" />}>
              {action.label}
            </QuickActionButton>
          </ScrollReveal>
        ))}
      </div>

      <div className="mt-4 border-t border-border/70 pt-3">
        <motion.button
          {...press}
          type="button"
          onClick={toggleFullyBooked}
          className={cn(
            "flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            fullyBooked ? "bg-attention/10 text-attention" : "text-muted-foreground hover:bg-muted/40"
          )}
        >
          <span className="text-[12.5px] font-medium">
            {fullyBooked ? "Fully booked today" : "Mark fully booked today?"}
          </span>
          <SwitchVisual checked={fullyBooked} />
        </motion.button>
        <div className="flex min-h-[20px] justify-center pt-1">
          <Acknowledgement message={message} isError={isError} isSaving={isSaving} className="text-[12px]" />
        </div>
      </div>
    </ScrollReveal>
  );
}

/**
 * Sprint 7.5: added a visible focus ring (keyboard users previously
 * got only the browser's default outline, inconsistent with the rest
 * of the app) and a subtle icon-tint shift on hover, so hovering
 * reads as "this icon is about to respond," not just "the card moved."
 */
function QuickActionButton({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <motion.div
        {...press}
        className="flex min-h-[80px] flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 p-3 text-center transition-all hover:-translate-y-0.5 hover:border-success/25 hover:bg-muted/60 hover:shadow-sm"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10 text-success transition-colors group-hover:bg-success/20">
          {icon}
        </div>
        <span className="text-[12.5px] font-semibold leading-tight">{children}</span>
      </motion.div>
    </Link>
  );
}

/**
 * A different kind of action from the routine Quick Actions — connecting
 * WhatsApp is a one-time, load-bearing step (she can't do her job at
 * all without it), not a daily habit. It earns its own prominent
 * banner rather than sharing the grid.
 */
export function ConnectWhatsAppBanner() {
  return (
    <ScrollReveal>
      <Link
        href="/dashboard/whatsapp"
        className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <motion.div
          {...press}
          className="flex items-center gap-3.5 rounded-2xl bg-success p-4 text-success-foreground shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-bold">Connect WhatsApp</p>
            <p className="mt-0.5 text-[12.5px] text-success-foreground/85">
              I&apos;m ready — I just can&apos;t hear your customers yet.
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </motion.div>
      </Link>
    </ScrollReveal>
  );
}
