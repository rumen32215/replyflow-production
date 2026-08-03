"use client";

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
 * The one static, curated conversation on this page — deliberately not
 * a live call to the real reply pipeline (unlike the onboarding demo,
 * `preparing-receptionist.tsx`). A stranger's first ever look at the
 * product is the wrong place to risk a real model call's variance;
 * the live version of this proof already exists, inside the product,
 * for a visitor who's created an account (Test Conversations). This
 * is honestly labelled as an example for exactly that reason — Visual
 * Language §0.1: everything here has to earn understanding, trust, or
 * confidence, and a demo mistaken for a live claim would spend trust,
 * not build it.
 */

const DEMO_CUSTOMER_MESSAGE = "Hi, my kitchen tap's been dripping non-stop since this morning — any chance someone can look today?";
const DEMO_REPLY = "That's an easy one for us — no call-out fee for a job like that. I've got a slot at 4pm today, would that work?";

function DemoConversation() {
  const { display, isThinking } = useTypedMessage(DEMO_REPLY);

  return (
    <div>
      <PhoneFrame businessName="Dean's Plumbing" className="mx-auto max-w-[300px]">
        <Bubble from="customer">{DEMO_CUSTOMER_MESSAGE}</Bubble>
        <Bubble from="receptionist" className="min-h-[34px]">
          {isThinking || display.length === 0 ? <TypingDots className="px-1 py-1" /> : <span>{display}</span>}
        </Bubble>
      </PhoneFrame>
      <p className="mt-3 text-center text-[12px] text-muted-foreground/70">
        An example of the kind of reply she drafts — never invented, always checked against what you&apos;ve taught her.
      </p>
    </div>
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

      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 sm:py-28 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:py-32">
        <div>
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
            transition={{ duration: 0.55, ease: EASE, delay: 0.1 }}
            className="text-[34px] font-extrabold leading-[1.12] tracking-tight sm:text-[42px] lg:text-[50px]"
          >
            Never miss another job because you were{" "}
            <GradientText>up a ladder</GradientText>.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.28 }}
            className="mt-6 max-w-[46ch] text-[17px] leading-relaxed text-muted-foreground sm:text-[18px]"
          >
            ReplyFlow answers your WhatsApp while you work — and actually knows your business, not just how to chat.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.44 }}
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
                Start building my receptionist
                <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-1" />
              </span>
            </motion.button>
            <p className="mt-3 text-[13.5px] font-medium text-muted-foreground">
              7-day free trial. No credit card required.
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.55 }}
        >
          <DemoConversation />
        </motion.div>
      </div>
    </section>
  );
}
