"use client";

import {
  MessageCircle,
  Sparkles,
  BookOpen,
  FileText,
  CalendarCheck,
  Bell,
} from "lucide-react";
import { motion } from "framer-motion";
import { EASE, ScrollReveal } from "@/components/shared/motion";

/**
 * Landing Experience, Section 2 — was "The Invisible Weight" (worry
 * questions), then a dashboard-stat teaser (sixth founder review).
 *
 * Ninth founder review (2026-08-04): "this is now the weakest section
 * — someone discovering ReplyFlow has no idea what these numbers
 * mean." The phone above already demonstrates the product; this
 * section's job is to answer the next question a genuinely interested
 * visitor has — "what actually happens after I sign up?" — with a
 * small, labelled preview of the real dashboard (`Front Desk`) rather
 * than unexplained counts. Also fixes a real gap named directly: the
 * WhatsApp Business connection (one of the biggest selling points)
 * was barely mentioned anywhere on the page — it's now the first,
 * most visually distinct tile, in the product's real WhatsApp green,
 * plus its own explicit line beneath the preview.
 */

interface Tile {
  icon: typeof Sparkles;
  tone: "primary" | "success" | "attention" | "learning";
  text: string;
}

const TILES: readonly Tile[] = [
  { icon: Sparkles, tone: "primary", text: "Receptionist online" },
  { icon: BookOpen, tone: "learning", text: "Business knowledge taught" },
  { icon: FileText, tone: "primary", text: "Quotes ready to send" },
  { icon: CalendarCheck, tone: "success", text: "Appointments booked" },
  { icon: MessageCircle, tone: "attention", text: "Customer waiting for a reply" },
  { icon: Bell, tone: "learning", text: "Team notified" },
] as const;

const TONE_CLASSES: Record<Tile["tone"], string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  attention: "bg-attention/10 text-attention",
  learning: "bg-learning/10 text-learning",
};

export function DashboardPreview() {
  return (
    <section className="bg-card">
      <div className="mx-auto max-w-lg px-6 py-20 text-center sm:py-28 lg:py-32">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -80px 0px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="text-[21px] font-semibold leading-relaxed text-foreground sm:text-[24px]"
        >
          What happens the moment you sign up?
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -80px 0px" }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.25 }}
          className="mt-4 text-[15px] text-muted-foreground"
        >
          In minutes, ReplyFlow becomes the digital front desk for your business.
        </motion.p>

        {/* A real, labelled window — "Front Desk" is the product's own
         * name for this screen, not an invented mockup title — with a
         * live "online" pulse so the preview itself feels alive, the
         * same instinct as the phone above. */}
        <ScrollReveal
          delay={0.5}
          className="mt-10 overflow-hidden rounded-2xl border border-border bg-background text-left shadow-md"
        >
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
            <div className="flex items-center gap-1.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/40" />
              <span className="h-2.5 w-2.5 rounded-full bg-attention/50" />
              <span className="h-2.5 w-2.5 rounded-full bg-success/50" />
            </div>
            <span className="text-[12px] font-semibold text-foreground/70">Front Desk</span>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-success">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              Online
            </span>
          </div>

          <div className="p-4 sm:p-5">
            {/* The WhatsApp connection is one of the biggest selling
             * points and the page barely said it out loud — this tile
             * is deliberately larger and in WhatsApp's own real green
             * (not the app's internal `success` token), so it reads as
             * distinct on sight, not just another row in the list. */}
            <ScrollReveal
              delay={0.6}
              className="mb-3 flex items-center gap-3 rounded-xl border border-[#25D366]/25 bg-[#25D366]/[0.08] px-3.5 py-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#25D366]/15">
                <MessageCircle className="h-[18px] w-[18px] text-[#128C4A]" strokeWidth={2.5} />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-foreground">WhatsApp Business connected</p>
                <p className="text-[12px] text-muted-foreground">Your existing number — no new app for customers to learn.</p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {TILES.map((tile, i) => (
                <ScrollReveal
                  key={tile.text}
                  delay={0.7 + i * 0.08}
                  className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3 py-2.5"
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONE_CLASSES[tile.tone]}`}>
                    <tile.icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                  <span className="text-[13px] font-medium text-foreground">{tile.text}</span>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </ScrollReveal>

        <p className="mt-4 text-[12px] text-muted-foreground/70">
          An example office — not real data. Connects to the WhatsApp Business number you already use.
        </p>
      </div>
    </section>
  );
}
