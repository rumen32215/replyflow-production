"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { EASE } from "@/components/shared/motion";
import { GradientText } from "@/components/shared/gradient-text";
import { PhoneFrame, Bubble } from "@/components/shared/phone-preview";
import { TypingDots, useTypedMessage } from "@/components/shared/typed-message";

/**
 * Landing Experience, Section 1 — Hero (`DOCS/SPECS/ReplyFlow-Landing-
 * Experience-Design.md` §2, `DOCS/SPECS/ReplyFlow-Visual-Language.md`).
 *
 * Second founder review (2026-08-03) — an experience-design pass, not a
 * UI pass. Two decisions this rewrite is built around:
 *
 * 1. No chips, no picker. The first iteration made "interactive" mean
 *    "add buttons" — that reads as a software demo, not a receptionist
 *    at work. This version has no visitor-facing control at all: one
 *    believable, two-message conversation plays once, automatically,
 *    the moment it scrolls into view. The visitor witnesses it rather
 *    than operates it. The two exchanges are the same customer, back
 *    to back, deliberately — the second message only makes sense if
 *    she remembered the first (no re-asking what's already been said,
 *    a repeat-customer aside she wouldn't know to invent) — memory and
 *    business understanding demonstrated by the story itself, never
 *    stated as a claim.
 *
 * 2. The phone dominates. Stacked, not side-by-side: a short, centred
 *    line of text and one CTA up top, then one large, centred phone
 *    beneath — the product itself as the hero image, everything else
 *    reduced to what supports it.
 *
 * The conversation reuses the exact fresh-mount-per-turn typing
 * pattern already established in `preparing-receptionist.tsx`'s own
 * `TypedReply` (a new `useTypedMessage` instance per exchange, so nothing
 * is ever deleted and retyped — each reply arrives once and stays).
 * Still a static, curated example, not a live model call — honestly
 * labelled as one, per Visual Language §0.1.
 */

const CONVERSATION: readonly { customer: string; reply: string }[] = [
  {
    customer: "Hi, my kitchen tap's been dripping non-stop since this morning — any chance someone can look today?",
    reply: "That's an easy one for us — no call-out fee for a job like that. I've got a slot at 4pm today, would that work?",
  },
  {
    customer: "Perfect. Quick one — will it be Dean again? He did our bathroom last year.",
    reply: "It will, yeah — I'll let him know it's a repeat visit. See you at 4.",
  },
];

/** Mirrors `preparing-receptionist.tsx`'s own pacing formula — how long
 * a reply of this length takes to read as "typed," so the next
 * exchange never starts arriving mid-type. */
function estimateTypeMs(text: string): number {
  return 150 + 520 + Math.min(1500, Math.max(650, text.length * 14));
}

/** Fresh mount per exchange, identical convention to `preparing-
 * receptionist.tsx`'s own `TypedReply` — each reply types itself in
 * exactly once and is never touched again. */
function TypedReply({ text }: { text: string }) {
  const { display, isThinking } = useTypedMessage(text);
  return (
    <Bubble from="receptionist" className="min-h-[34px]">
      {isThinking || display.length === 0 ? <TypingDots className="px-1 py-1" /> : <span>{display}</span>}
    </Bubble>
  );
}

function AutoConversation() {
  const [visibleCount, setVisibleCount] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    // Deliberately no cleanup/cancellation here — same convention
    // `preparing-receptionist.tsx`'s own mount-once effect already
    // uses. Combining a `cancelled` flag with this ref guard is a real
    // Strict Mode trap: the dev-mode mount→unmount→remount cycle would
    // cancel the original run before it ever starts, while the ref
    // blocks a fresh one from replacing it — the animation would never
    // play at all. This is a bounded, one-shot sequence, not a
    // subscription, so nothing here needs cancelling.
    if (startedRef.current) return;
    startedRef.current = true;
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    async function run() {
      await wait(900); // let the phone itself settle before anything happens inside it
      for (let i = 0; i < CONVERSATION.length; i++) {
        if (i > 0) await wait(1300); // a real beat between messages, not a rushed reveal
        setVisibleCount(i + 1);
        await wait(estimateTypeMs(CONVERSATION[i]!.reply));
      }
    }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PhoneFrame businessName="Dean's Plumbing" className="mx-auto w-full max-w-[400px] shadow-lg">
      {CONVERSATION.slice(0, visibleCount).map((exchange, i) => (
        <div key={i}>
          <Bubble from="customer">{exchange.customer}</Bubble>
          <TypedReply text={exchange.reply} />
        </div>
      ))}
    </PhoneFrame>
  );
}

export function Hero() {
  const router = useRouter();

  return (
    <section className="relative overflow-hidden">
      {/* Ambient atmosphere only — the one motion purpose that doesn't
       * carry information (Visual Language §7 category 4). Identical
       * primitive already used on Front Desk's own arrival moment. */}
      <div className="aurora-layer" aria-hidden="true">
        <div className="aurora-blob aurora-blob-primary" />
        <div className="aurora-blob aurora-blob-success" />
      </div>

      <div className="relative mx-auto max-w-3xl px-6 pt-20 text-center sm:pt-28 lg:pt-32">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="mb-5 text-[13px] font-bold uppercase tracking-widest text-primary"
        >
          For plumbers, electricians, builders, roofers &amp; painters
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
          className="text-[34px] font-extrabold leading-[1.12] tracking-tight sm:text-[44px] lg:text-[52px]"
        >
          Never miss another job because you were{" "}
          <GradientText>up a ladder</GradientText>.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.4 }}
          className="mx-auto mt-6 max-w-[46ch] text-[17px] leading-relaxed text-muted-foreground sm:text-[18px]"
        >
          ReplyFlow answers your WhatsApp while you work — and actually knows your business, not just how to chat.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.65 }}
          className="mt-9"
        >
          <motion.button
            type="button"
            onClick={() => router.push("/signup")}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.985 }}
            transition={{ type: "spring", stiffness: 400, damping: 24 }}
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-primary px-7 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-sm transition-shadow duration-300 hover:shadow-[0_10px_30px_-8px_rgba(37,99,235,0.55)]"
          >
            <span className="relative z-10 flex items-center gap-2">
              Meet your receptionist
              <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-1" />
            </span>
          </motion.button>
          <p className="mt-3 text-[13.5px] font-medium text-muted-foreground">
            7 days free. No card needed. No commitment.
          </p>
        </motion.div>
      </div>

      <div className="relative mx-auto mt-16 max-w-[560px] px-6 pb-20 sm:mt-20 sm:pb-28 lg:pb-32">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.9 }}
          className="relative"
        >
          {/* The one focal glow — a single soft light source behind the
           * phone, static rather than animated (the phone's own slow
           * float below is already the one thing that moves here). */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(37,99,235,0.18), rgba(34,197,94,0.11) 55%, transparent 75%)" }}
          />
          <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}>
            <AutoConversation />
          </motion.div>
        </motion.div>

        <p className="mt-5 text-center text-[12px] text-muted-foreground/70">
          A real example of how she replies — never invented, always checked against what you&apos;ve taught her.
        </p>
      </div>
    </section>
  );
}
