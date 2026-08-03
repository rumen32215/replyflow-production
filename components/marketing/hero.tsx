"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { EASE, press } from "@/components/shared/motion";
import { GradientText } from "@/components/shared/gradient-text";
import { PhoneFrame, Bubble } from "@/components/shared/phone-preview";
import { TypingDots, useTypedMessage } from "@/components/shared/typed-message";
import { cn } from "@/lib/utils";

/**
 * Landing Experience, Section 1 — Hero (`DOCS/SPECS/ReplyFlow-Landing-
 * Experience-Design.md` §2, `DOCS/SPECS/ReplyFlow-Visual-Language.md`).
 * Quality pass (2026-08-03, founder review): the phone is now the
 * visual centerpiece, not a component sitting underneath the text —
 * larger, given the more generous half of the grid, and set inside its
 * own soft focal glow so it reads as one considered focal point rather
 * than sharing attention with everything around it.
 *
 * The three scenarios are still the one static, curated content on
 * this page — deliberately not a live call to the real reply pipeline
 * (unlike the onboarding demo, `preparing-receptionist.tsx`). A
 * stranger's first ever look at the product is the wrong place to risk
 * a real model call's variance; the live version of this proof already
 * exists, inside the product, for a visitor who's created an account
 * (Test Conversations). Honestly labelled as an example for exactly
 * that reason — Visual Language §0.1.
 *
 * "Alive, not static" is answered three ways, deliberately restrained
 * rather than layered (the founder's own note: usually one thing
 * moves, everything else waits): a single slow float on the phone
 * itself (the exact primitive already used for Welcome's logo mark,
 * reused rather than invented), the tap interaction itself (customer
 * message swaps, the reply deletes/thinks/retypes — `useTypedMessage`
 * already built for exactly this "knowledge changed" transition), and
 * nothing else moves independently of those two.
 */

interface Scenario {
  id: string;
  label: string;
  customerMessage: string;
  reply: string;
}

const SCENARIOS: readonly Scenario[] = [
  {
    id: "tap",
    label: "Leaking tap",
    customerMessage: "Hi, my kitchen tap's been dripping non-stop since this morning — any chance someone can look today?",
    reply: "That's an easy one for us — no call-out fee for a job like that. I've got a slot at 4pm today, would that work?",
  },
  {
    id: "boiler",
    label: "Boiler quote",
    customerMessage: "Hi, can you give me a rough price for a new boiler installation?",
    reply:
      "That really depends on the boiler and your current setup, so I don't want to guess — I'll get one of the team to call you back with a proper quote. What's the best number to reach you on?",
  },
  {
    id: "emergency",
    label: "Emergency call-out",
    customerMessage: "There's water coming through my ceiling right now, I think a pipe's burst!",
    reply: "That sounds urgent — I'm flagging this for the team straight away, someone will call you in the next few minutes. If you can, turn off your stopcock in the meantime.",
  },
] as const;

function ScenarioChips({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className="mt-5 flex flex-wrap justify-center gap-2">
      {SCENARIOS.map((scenario) => {
        const selected = scenario.id === selectedId;
        return (
          <motion.button
            key={scenario.id}
            {...press}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(scenario.id)}
            className={cn(
              "rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors",
              selected
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
            )}
          >
            {scenario.label}
          </motion.button>
        );
      })}
    </div>
  );
}

function DemoConversation() {
  const [scenarioId, setScenarioId] = useState<string>(SCENARIOS[0]!.id);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
  const { display, isThinking } = useTypedMessage(scenario.reply);

  return (
    <div>
      <div className="relative mx-auto max-w-[400px]">
        {/* The one focal glow — a single soft light source behind the
         * phone, not decoration scattered around it. Static, not
         * animated: per the founder's own note, the phone's slow float
         * below is already "the one thing that moves" here. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(37,99,235,0.16), rgba(34,197,94,0.10) 55%, transparent 75%)" }}
        />
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <PhoneFrame businessName="Dean's Plumbing" className="mx-auto max-w-[360px] shadow-lg">
            <AnimatePresence mode="wait">
              <motion.div
                key={scenario.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
              >
                <Bubble from="customer">{scenario.customerMessage}</Bubble>
              </motion.div>
            </AnimatePresence>
            <Bubble from="receptionist" className="min-h-[34px]">
              {isThinking || display.length === 0 ? <TypingDots className="px-1 py-1" /> : <span>{display}</span>}
            </Bubble>
          </PhoneFrame>
        </motion.div>
      </div>

      <ScenarioChips selectedId={scenarioId} onSelect={setScenarioId} />

      <p className="mt-4 text-center text-[12px] text-muted-foreground/70">
        Real examples of how she replies — never invented, always checked against what you&apos;ve taught her.
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

      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 sm:py-28 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:gap-10 lg:py-32">
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
            className="text-[34px] font-extrabold leading-[1.12] tracking-tight sm:text-[42px] lg:text-[46px]"
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
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.5 }}
        >
          <DemoConversation />
        </motion.div>
      </div>
    </section>
  );
}
