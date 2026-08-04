"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarCheck,
  UserPlus,
  MessageCircle,
  Sparkles,
  BookOpen,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { EASE } from "@/components/shared/motion";
import { cn } from "@/lib/utils";

/**
 * Landing Experience, Section 2 — third version of this section.
 * `day-in-the-life.tsx` (a fictional day's timeline) was replaced
 * outright when the second phone it leaned on started competing with
 * the Hero phone. That replacement then over-corrected into prose.
 *
 * V14 founder review (2026-08-04), verbatim: "I understand why the
 * previous phone was removed. That was the correct decision. However
 * this replacement has gone too far in the opposite direction. It is
 * now mostly text... Nothing rewards scrolling. Nothing creates
 * trust... Bring back the feeling the old Front Desk section created.
 * Not the design. The feeling. Organisation. Confidence. Systems.
 * Everything connected. Everything handled... Think of it as the
 * control centre behind everything the visitor has just watched
 * happen."
 *
 * Still no second phone (that verdict stands) and still no wall of
 * copy (that was the actual complaint about the previous version) —
 * a wide, non-phone-framed panel instead, echoing the Hero dashboard's
 * own eight status items (`hero-phone.tsx`'s `DASHBOARD_ACT`,
 * duplicated here rather than imported: eight short static labels,
 * not worth a cross-file dependency for). Repetition-with-a-new-frame
 * is the point — the visitor already watched these things happen one
 * at a time; this section is what it looks like once they're all true
 * at once. Reveals once via `whileInView`, never a timed auto-loop —
 * this section supports the Hero phone, it doesn't compete with it.
 */

interface StatusItem {
  icon: typeof AlertTriangle;
  text: string;
  tone: "whatsapp" | "primary" | "success" | "attention";
}

const STATUS_ITEMS: readonly StatusItem[] = [
  { icon: MessageCircle, text: "WhatsApp connected", tone: "whatsapp" },
  { icon: Sparkles, text: "Receptionist online", tone: "primary" },
  { icon: BookOpen, text: "Business knowledge learned", tone: "primary" },
  { icon: FileText, text: "Quotes ready", tone: "primary" },
  { icon: CalendarCheck, text: "Appointments booked", tone: "success" },
  { icon: UserPlus, text: "Customers updated", tone: "success" },
  { icon: AlertTriangle, text: "Urgent jobs prioritised", tone: "attention" },
  { icon: CheckCircle2, text: "Nothing waiting for you", tone: "success" },
] as const;

const STATUS_STYLES: Record<StatusItem["tone"], { badge: string; icon_: string }> = {
  whatsapp: { badge: "bg-[#25D366]/15", icon_: "text-[#128C4A]" },
  primary: { badge: "bg-primary/15", icon_: "text-primary" },
  success: { badge: "bg-success/15", icon_: "text-success" },
  attention: { badge: "bg-attention/20", icon_: "text-attention" },
};

export function PeaceOfMind() {
  return (
    <section className="relative overflow-hidden bg-card">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 20%, rgba(37,99,235,0.05), transparent 60%), radial-gradient(ellipse 70% 55% at 50% 85%, rgba(34,197,94,0.06), transparent 60%)",
        }}
      />

      <div className="relative mx-auto max-w-3xl px-6 py-24 text-center sm:py-32 lg:py-36">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -100px 0px" }}
          transition={{ duration: 0.5, ease: EASE }}
          className="text-[13px] font-bold uppercase tracking-widest text-primary/60"
        >
          How your business stays organised
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -100px 0px" }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.08 }}
          className="mx-auto mt-4 max-w-[36ch] text-[19px] leading-relaxed text-foreground/80 sm:text-[21px]"
        >
          Everything that happened above, quietly running underneath.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "0px 0px -100px 0px" }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
          className="relative mt-12 overflow-hidden rounded-3xl border border-border/50 bg-background/80 text-left shadow-[0_1px_3px_rgba(15,23,42,0.04),0_24px_55px_-30px_rgba(15,23,42,0.2)] backdrop-blur-sm sm:mt-14"
        >
          <div className="flex items-center gap-3 bg-gradient-to-r from-primary to-success px-5 py-3.5 text-white">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20">
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
                <path d="M4 20l1.6-4.8A8 8 0 1112 20a7.96 7.96 0 01-3.9-1L4 20z" fill="white" />
              </svg>
            </span>
            <p className="text-[13px] font-semibold leading-tight">ReplyFlow — running now</p>
          </div>

          <div className="grid grid-cols-2 gap-3 p-5 sm:p-7 lg:grid-cols-4">
            {STATUS_ITEMS.map((item, i) => {
              const isLast = i === STATUS_ITEMS.length - 1;
              const { badge, icon_ } = STATUS_STYLES[item.tone];
              return (
                <motion.div
                  key={item.text}
                  initial={{ opacity: 0, y: 12, scale: 0.94 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: "0px 0px -60px 0px" }}
                  transition={{ type: "spring", stiffness: 340, damping: 24, delay: i * 0.07 }}
                  className={cn(
                    "relative flex flex-col items-start gap-2 rounded-xl border p-3",
                    isLast ? "border-primary/25 bg-primary/[0.06]" : "border-border/50 bg-white/60"
                  )}
                >
                  {isLast && (
                    <motion.span
                      aria-hidden
                      className="pointer-events-none absolute -inset-2 -z-10 rounded-2xl bg-primary/25 blur-lg"
                      initial={{ opacity: 0, scale: 0.7 }}
                      whileInView={{ opacity: [0, 0.9, 0.4], scale: [0.7, 1.15, 1] }}
                      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
                      transition={{ duration: 1, ease: EASE, delay: i * 0.07 + 0.2 }}
                    />
                  )}
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", badge)}>
                    <item.icon className={cn("h-4 w-4", icon_)} strokeWidth={2.5} />
                  </span>
                  <span className={cn("text-[12.5px] font-semibold leading-snug", isLast ? "text-primary" : "text-foreground")}>
                    {item.text}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
