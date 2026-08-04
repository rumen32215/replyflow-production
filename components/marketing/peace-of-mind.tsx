"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUp,
  CalendarCheck,
  Check,
  UserPlus,
  MessageCircle,
  Sparkles,
  BookOpen,
  FileText,
} from "lucide-react";
import { EASE } from "@/components/shared/motion";
import { useLaunchTransition, TRANSITION_NAVIGATE_MS } from "@/components/shared/page-transition";
import { cn } from "@/lib/utils";

/**
 * Landing Experience, Section 2 — fifth version of this section.
 * `day-in-the-life.tsx` (a fictional day's timeline) was replaced when
 * the second phone it leaned on started competing with the Hero
 * phone. That over-corrected into prose, which V14 replaced with this
 * status panel, which V15 gave one shared "quiet pulse" replay.
 *
 * V16 founder review (2026-08-04), verbatim: "the cards transition
 * into green. That direction is good. However it currently feels like
 * someone is simply clicking through checkboxes... Each card should
 * quietly perform its own job." Each tile's second moment is now
 * content-specific (`MICRO_ACTIONS` below) instead of one shared
 * replayed bloom — still only three small primitives (a connecting
 * ring, a presence dot, a small arriving badge), reused across the
 * seven tiles rather than seven bespoke systems, so "each does its own
 * job" without becoming "no looping chaos, no dashboard overload" (the
 * same restraint V15 was already given credit for).
 *
 * "Instead of 'ReplyFlow — Running now,' consider making the header
 * itself feel live... allow this header to quietly rotate genuinely
 * useful status updates." `STATUS_TICKER` below, gated behind the same
 * `onViewportEnter` trigger as the tile choreography — this section
 * still never runs anything before a visitor has actually scrolled to
 * it.
 *
 * "The card currently repeats 'Nothing waiting for you' and then
 * 'Meet your receptionist'... communicate one primary action." The
 * status line is dropped; the action is the only message left.
 */

interface StatusItem {
  icon: typeof AlertTriangle;
  text: string;
  tone: "whatsapp" | "primary" | "success" | "attention" | "learning";
  micro: { kind: "ring" | "dot" | "badge"; icon?: typeof AlertTriangle };
}

const STATUS_ITEMS: readonly StatusItem[] = [
  { icon: MessageCircle, text: "WhatsApp connected", tone: "whatsapp", micro: { kind: "ring" } },
  { icon: Sparkles, text: "Receptionist online", tone: "primary", micro: { kind: "dot" } },
  { icon: BookOpen, text: "Business knowledge learned", tone: "learning", micro: { kind: "badge", icon: Sparkles } },
  { icon: FileText, text: "Quotes ready", tone: "primary", micro: { kind: "badge", icon: FileText } },
  { icon: CalendarCheck, text: "Appointments booked", tone: "success", micro: { kind: "badge", icon: Check } },
  { icon: UserPlus, text: "Customers updated", tone: "success", micro: { kind: "dot" } },
  { icon: AlertTriangle, text: "Urgent jobs prioritised", tone: "attention", micro: { kind: "badge", icon: ArrowUp } },
] as const;

const STATUS_STYLES: Record<StatusItem["tone"], { badge: string; icon_: string; glow: string; solid: string; ring: string }> = {
  whatsapp: { badge: "bg-[#25D366]/15", icon_: "text-[#128C4A]", glow: "bg-[#25D366]/45", solid: "bg-[#25D366]", ring: "border-[#25D366]" },
  primary: { badge: "bg-primary/15", icon_: "text-primary", glow: "bg-primary/45", solid: "bg-primary", ring: "border-primary" },
  success: { badge: "bg-success/15", icon_: "text-success", glow: "bg-success/45", solid: "bg-success", ring: "border-success" },
  attention: { badge: "bg-attention/20", icon_: "text-attention", glow: "bg-attention/45", solid: "bg-attention", ring: "border-attention" },
  learning: { badge: "bg-learning/15", icon_: "text-learning", glow: "bg-learning/45", solid: "bg-learning", ring: "border-learning" },
};

const STATUS_TICKER = [
  "Looking after your business",
  "No actions waiting",
  "Two jobs booked for tomorrow",
  "Every message has a reply",
  "One quote ready to send",
  "Nothing urgent right now",
] as const;

/** A tile's own brief second moment — three shared shapes, never
 * seven bespoke ones. `ring` reads as "just connected," `dot` as "a
 * live presence," `badge` as "something specific just arrived." */
function MicroAction({ pulsing, kind, icon: Icon, styles }: { pulsing: boolean; kind: StatusItem["micro"]["kind"]; icon?: typeof AlertTriangle; styles: (typeof STATUS_STYLES)[StatusItem["tone"]] }) {
  if (!pulsing) return null;
  if (kind === "ring") {
    return (
      <motion.span
        aria-hidden
        className={cn("pointer-events-none absolute left-0 top-0 h-8 w-8 rounded-lg border-2", styles.ring)}
        initial={{ opacity: 0.75, scale: 0.75 }}
        animate={{ opacity: 0, scale: 1.7 }}
        transition={{ duration: 0.75, ease: EASE }}
      />
    );
  }
  if (kind === "dot") {
    return (
      <motion.span
        aria-hidden
        className={cn("pointer-events-none absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white", styles.solid)}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 1, 1, 1, 0], scale: [0.4, 1.2, 1, 1.15, 1] }}
        transition={{ duration: 1.3, ease: EASE, times: [0, 0.2, 0.45, 0.7, 1] }}
      />
    );
  }
  return (
    <motion.span
      aria-hidden
      className={cn("pointer-events-none absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-white shadow-sm", styles.solid)}
      initial={{ opacity: 0, scale: 0.3, y: 5 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.1, 1, 0.9], y: 0 }}
      transition={{ duration: 1.35, ease: EASE, times: [0, 0.3, 0.75, 1] }}
    >
      {Icon && <Icon className="h-2.5 w-2.5" strokeWidth={3} />}
    </motion.span>
  );
}

export function PeaceOfMind() {
  const router = useRouter();
  const launchTransition = useLaunchTransition();
  const [isNavigating, setIsNavigating] = useState(false);
  const [pulseIndex, setPulseIndex] = useState(-1);
  const [settled, setSettled] = useState(false);
  const [tickerIndex, setTickerIndex] = useState(0);
  const startedRef = useRef(false);
  const tickerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    router.prefetch("/signup");
    return () => {
      if (tickerIntervalRef.current) clearInterval(tickerIntervalRef.current);
    };
  }, [router]);

  function handleMeetReceptionist(e: React.MouseEvent<HTMLButtonElement>) {
    if (isNavigating) return;
    setIsNavigating(true);
    const rect = e.currentTarget.getBoundingClientRect();
    launchTransition({
      x: ((rect.left + rect.width / 2) / window.innerWidth) * 100,
      y: ((rect.top + rect.height / 2) / window.innerHeight) * 100,
    });
    setTimeout(() => router.push("/signup"), TRANSITION_NAVIGATE_MS);
  }

  const startChoreography = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    tickerIntervalRef.current = setInterval(() => {
      setTickerIndex((i) => (i + 1) % STATUS_TICKER.length);
    }, 3400);
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    async function run() {
      await wait(1100);
      for (let i = 0; i < STATUS_ITEMS.length; i++) {
        setPulseIndex(i);
        await wait(420);
      }
      setPulseIndex(-1);
      await wait(150);
      setSettled(true);
    }
    void run();
  }, []);

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
          onViewportEnter={startChoreography}
          transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
          className="relative mt-12 overflow-hidden rounded-3xl border border-border/50 bg-background/80 text-left shadow-[0_1px_3px_rgba(15,23,42,0.04),0_24px_55px_-30px_rgba(15,23,42,0.2)] backdrop-blur-sm sm:mt-14"
        >
          <div className="flex items-center gap-3 bg-gradient-to-r from-primary to-success px-5 py-3.5 text-white">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20">
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
                <path d="M4 20l1.6-4.8A8 8 0 1112 20a7.96 7.96 0 01-3.9-1L4 20z" fill="white" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {/* A real "live" indicator, not decorative — the one
                 * infinite loop this section allows itself, the same
                 * register every "recording"/"live" dot anywhere
                 * already uses, and small enough to never read as
                 * busy. */}
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="absolute inset-0 animate-ping rounded-full bg-white/70" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                <p className="text-[13px] font-semibold leading-tight">ReplyFlow</p>
              </div>
              <div className="relative h-[17px] overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={tickerIndex}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className="truncate text-[11.5px] leading-tight text-white/85"
                  >
                    {STATUS_TICKER[tickerIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-5 sm:p-7 lg:grid-cols-4">
            {STATUS_ITEMS.map((item, i) => {
              const styles = STATUS_STYLES[item.tone];
              return (
                <motion.div
                  key={item.text}
                  initial={{ opacity: 0, y: 12, scale: 0.94 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: "0px 0px -60px 0px" }}
                  transition={{ type: "spring", stiffness: 340, damping: 24, delay: i * 0.07 }}
                  className={cn(
                    "relative flex flex-col items-start gap-2 rounded-xl border p-3 transition-colors duration-500",
                    settled ? "border-success/30 bg-success/[0.05]" : "border-border/50 bg-white/60"
                  )}
                >
                  <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                    <span className={cn("absolute inset-0 rounded-lg", styles.badge)} aria-hidden />
                    <item.icon className={cn("relative h-4 w-4", styles.icon_)} strokeWidth={2.5} />
                    <MicroAction pulsing={pulseIndex === i} kind={item.micro.kind} icon={item.micro.icon} styles={styles} />
                  </span>
                  <span className="text-[12.5px] font-semibold leading-snug text-foreground">{item.text}</span>
                </motion.div>
              );
            })}

            {/* The eighth position — a real CTA, one message only.
             * V15 paired it with "Nothing waiting for you" as a small
             * supporting line; the founder named that as repeating the
             * same emotional beat the tiles above it already resolve
             * into (`settled`) — dropped, so the only thing this card
             * says is what to do next. */}
            <motion.button
              type="button"
              onClick={handleMeetReceptionist}
              initial={{ opacity: 0, y: 12, scale: 0.94 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "0px 0px -60px 0px" }}
              whileHover={isNavigating ? undefined : { y: -2 }}
              whileTap={isNavigating ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 340, damping: 24, delay: STATUS_ITEMS.length * 0.07 }}
              className="group relative flex flex-col items-start justify-center gap-1 overflow-hidden rounded-xl bg-gradient-to-br from-primary to-success p-3 text-left shadow-sm transition-shadow duration-300 hover:shadow-[0_10px_26px_-8px_rgba(37,99,235,0.5)]"
            >
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-[20deg] bg-gradient-to-r from-transparent via-white/25 to-transparent"
                initial={{ x: "-160%" }}
                animate={{ x: "460%" }}
                transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity, repeatDelay: 3 }}
              />
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20">
                <ArrowRight className="h-4 w-4 text-white transition-transform duration-300 ease-out group-hover:translate-x-0.5" strokeWidth={2.5} />
              </span>
              <span className="relative text-[13px] font-semibold leading-snug text-white">Meet your receptionist</span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
