"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
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
 * Landing Experience, Section 2 — fourth version of this section.
 * `day-in-the-life.tsx` (a fictional day's timeline) was replaced when
 * the second phone it leaned on started competing with the Hero
 * phone. That replacement over-corrected into prose, which V14
 * replaced with this status panel — closer, but still static.
 *
 * V15 founder review (2026-08-04), verbatim: "The concept is correct.
 * Do not redesign it. Instead make it feel alive... static cards...
 * make the organisation panel quietly work... Each action should
 * happen quietly. No looping chaos. No dashboard overload... After
 * everything has quietly updated, create one satisfying transition.
 * All activity resolves into one final state."
 *
 * One shared mechanism, not seven bespoke ones (`avoid adding
 * complexity`): every status tile replays its own arrival bloom a
 * second time, once, in a slow sequence (`pulseIndex` below) — the
 * same visual language `hero-phone.tsx`'s Dashboard tiles already use
 * for "a job just completed," continued here rather than reinvented.
 * Once the sequence has touched every tile, all of them settle
 * together in one shared, synchronized glow — the "everything resolves
 * into one final state" moment — before the reader's eye naturally
 * lands on the eighth tile: no longer a status, now a real CTA.
 *
 * "Replace the final 'Nothing waiting for you' card with a real CTA...
 * this should feel like the natural conclusion of everything they've
 * just watched." The line itself was also named as "already correct"
 * and worth keeping — so it stays, now as this action's own quiet
 * supporting line rather than a status statement with nothing to do
 * next.
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
] as const;

const STATUS_STYLES: Record<StatusItem["tone"], { badge: string; icon_: string; glow: string }> = {
  whatsapp: { badge: "bg-[#25D366]/15", icon_: "text-[#128C4A]", glow: "bg-[#25D366]/45" },
  primary: { badge: "bg-primary/15", icon_: "text-primary", glow: "bg-primary/45" },
  success: { badge: "bg-success/15", icon_: "text-success", glow: "bg-success/45" },
  attention: { badge: "bg-attention/20", icon_: "text-attention", glow: "bg-attention/45" },
};

/** One tile's second, quiet bloom — the exact same shape as its own
 * arrival bloom, replayed once when `pulsing` turns true. Never a
 * loop: each tile gets exactly one extra moment, in its own turn. */
function QuietPulse({ pulsing, settled, glow }: { pulsing: boolean; settled: boolean; glow: string }) {
  if (!pulsing && !settled) return null;
  return (
    <motion.span
      aria-hidden
      className={cn("pointer-events-none absolute -inset-1.5 -z-10 rounded-2xl blur-md", settled ? "bg-success/40" : glow)}
      initial={{ opacity: 0.5, scale: 0.9 }}
      animate={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: settled ? 0.9 : 0.55, ease: EASE }}
    />
  );
}

export function PeaceOfMind() {
  const router = useRouter();
  const launchTransition = useLaunchTransition();
  const [isNavigating, setIsNavigating] = useState(false);
  const [pulseIndex, setPulseIndex] = useState(-1);
  const [settled, setSettled] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    router.prefetch("/signup");
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
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    async function run() {
      await wait(1100);
      for (let i = 0; i < STATUS_ITEMS.length; i++) {
        setPulseIndex(i);
        await wait(380);
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
            <p className="text-[13px] font-semibold leading-tight">ReplyFlow — running now</p>
          </div>

          <div className="grid grid-cols-2 gap-3 p-5 sm:p-7 lg:grid-cols-4">
            {STATUS_ITEMS.map((item, i) => {
              const { badge, icon_, glow } = STATUS_STYLES[item.tone];
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
                  <QuietPulse pulsing={pulseIndex === i} settled={settled} glow={glow} />
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", badge)}>
                    <item.icon className={cn("h-4 w-4", icon_)} strokeWidth={2.5} />
                  </span>
                  <span className="text-[12.5px] font-semibold leading-snug text-foreground">{item.text}</span>
                </motion.div>
              );
            })}

            {/* The eighth position — where a "Nothing waiting for you"
             * status card used to sit. That line is kept (it was
             * named as already correct) as this action's own quiet
             * supporting line; the card itself is now a real CTA,
             * matching "Meet your receptionist"'s own interaction
             * language rather than copying its styling outright. */}
            <motion.button
              type="button"
              onClick={handleMeetReceptionist}
              initial={{ opacity: 0, y: 12, scale: 0.94 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "0px 0px -60px 0px" }}
              whileHover={isNavigating ? undefined : { y: -2 }}
              whileTap={isNavigating ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 340, damping: 24, delay: STATUS_ITEMS.length * 0.07 }}
              className="group relative flex flex-col items-start gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-primary to-success p-3 text-left shadow-sm transition-shadow duration-300 hover:shadow-[0_10px_26px_-8px_rgba(37,99,235,0.5)]"
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
              <span className="relative">
                <span className="block text-[10px] font-medium uppercase tracking-wide text-white/75">Nothing waiting for you</span>
                <span className="text-[12.5px] font-semibold leading-snug text-white">Meet your receptionist</span>
              </span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
