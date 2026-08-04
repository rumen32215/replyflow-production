"use client";

import { motion } from "framer-motion";
import { ClipboardCheck, CalendarCheck, Clock, UserPlus, AlertTriangle, Bell, FileText } from "lucide-react";
import { EASE } from "@/components/shared/motion";
import { cn } from "@/lib/utils";

/**
 * What a WhatsApp exchange quietly leaves behind once it settles — a
 * system moment, not another chat bubble, so it never reads as
 * something either party "said." Originally Hero-only
 * (`components/marketing/hero.tsx`); promoted to a shared component
 * (2026-08-04) when Day-in-the-Life needed the exact same grammar for
 * its own conversation snapshots — deliberately the same component,
 * not a lookalike, so a booking confirmation reads identically
 * wherever it appears on the page (section continuity).
 *
 * `kind` picks both the icon and the accent colour from `MOMENT_STYLES`
 * below — real visual hierarchy (Linear/Stripe/Apple notification
 * language), never one generic green success box repeated.
 */
export interface ProductMoment {
  text: string;
  kind: "job" | "booking" | "scheduled" | "customer" | "urgent" | "team" | "quote";
}

const MOMENT_STYLES: Record<ProductMoment["kind"], { icon: typeof ClipboardCheck; badge: string; icon_: string }> = {
  job: { icon: ClipboardCheck, badge: "bg-success/15", icon_: "text-success" },
  booking: { icon: CalendarCheck, badge: "bg-primary/15", icon_: "text-primary" },
  scheduled: { icon: Clock, badge: "bg-learning/15", icon_: "text-learning" },
  customer: { icon: UserPlus, badge: "bg-success/15", icon_: "text-success" },
  urgent: { icon: AlertTriangle, badge: "bg-attention/20", icon_: "text-attention" },
  team: { icon: Bell, badge: "bg-primary/15", icon_: "text-primary" },
  quote: { icon: FileText, badge: "bg-learning/15", icon_: "text-learning" },
};

/** `urgent` gets a visibly heavier treatment (tinted card, coloured
 * border) than the routine confirmations — some outcomes should feel
 * more important than others, not every one carrying equal weight. A
 * tactile hover/press response, not a new screen to open — there's
 * nothing further to reveal underneath (illustrative, not real data),
 * so the interaction is honestly just that: it responds to touch, the
 * way a real notification would. */
export function ProductMomentCard({ moment }: { moment: ProductMoment }) {
  const { icon: Icon, badge, icon_ } = MOMENT_STYLES[moment.kind];
  const isUrgent = moment.kind === "urgent";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ scale: 1.025, y: -1 }}
      whileTap={{ scale: 0.965 }}
      transition={{ duration: 0.5, ease: EASE }}
      className={cn(
        "mx-auto flex max-w-[88%] cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-[12px] font-semibold shadow-sm backdrop-blur-sm transition-shadow duration-300 hover:shadow-md",
        isUrgent ? "border-attention/30 bg-attention/[0.08] text-attention" : "border-border/60 bg-white/90 text-foreground"
      )}
    >
      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg", badge)}>
        <Icon className={cn("h-3.5 w-3.5", icon_)} strokeWidth={2.5} />
      </span>
      {moment.text}
    </motion.div>
  );
}
