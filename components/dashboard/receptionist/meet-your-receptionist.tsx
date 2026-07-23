"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Pencil } from "lucide-react";
import { SettleCard, press, EASE } from "@/components/shared/motion";
import { Button } from "@/components/ui/button";
import type { HandoverRecap } from "@/lib/receptionist-handover";
import { THE_PROMISE } from "@/lib/receptionist-handover";
import { cn } from "@/lib/utils";

/**
 * Meet Your Receptionist — Trust Track, DOCS/CONSTITUTION/03 §2.
 * Principles supported: 1 (trust demonstrated, not asserted), 2 (a
 * hire, not a config screen), 6 (proof before permission). Unlocks
 * Test Conversations (Trust Track, next).
 *
 * Every line of the recap arrives as a prop, built by the deterministic
 * `buildHandoverRecap` — this component never invents text of its own
 * beyond fixed framing copy ("Have I understood you correctly?" etc.).
 * The one piece of real interaction: "actually, no" routes back to
 * teaching rather than pretending the recap was accepted.
 */

function Bubble({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay }}
      className="max-w-[560px] rounded-2xl rounded-bl-md bg-card px-4 py-3 text-[14.5px] leading-relaxed text-foreground shadow-sm border border-border"
    >
      {children}
    </motion.div>
  );
}

export function MeetYourReceptionist({
  businessName,
  receptionistName,
  recap,
  correctBackHref,
}: {
  businessName: string;
  receptionistName: string | null;
  recap: HandoverRecap;
  /** Where "actually, no — let me fix something" sends the owner. */
  correctBackHref: string;
}) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const name = receptionistName || "your receptionist";

  if (recap.readiness === "empty") {
    return (
      <div className="mx-auto max-w-2xl">
        <SettleCard>
          <Bubble>
            Hi. I haven&apos;t learned much about {businessName} yet — no services or areas taught, so I don&apos;t
            have anything real to tell you. Let&apos;s fix that first, then come back and meet properly.
          </Bubble>
        </SettleCard>
        <div className="mt-5">
          <Button onClick={() => router.push(correctBackHref)} variant="primary" size="lg">
            Teach me first
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-[22px] font-extrabold tracking-tight md:text-[24px]">Meet {name}</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Not a settings summary — this is her, telling you what she&apos;s actually understood.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Bubble delay={0}>Hi. I&apos;ve finished learning about {businessName}. Here&apos;s what I&apos;ve understood:</Bubble>

        <Bubble delay={0.12}>
          <ul className="flex flex-col gap-1.5">
            {recap.understood.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-[3px] text-primary">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </Bubble>

        {recap.gaps.length > 0 && (
          <Bubble delay={0.22}>
            <p className="mb-1.5 font-semibold text-[13px] text-muted-foreground">And to be honest with you:</p>
            <ul className="flex flex-col gap-1.5">
              {recap.gaps.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-[3px] text-muted-foreground">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </Bubble>
        )}

        <Bubble delay={0.32}>
          <strong>Have I understood you correctly?</strong>
        </Bubble>

        <AnimatePresence mode="wait">
          {!confirmed ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, delay: 0.42 }}
              className="mt-1 flex flex-wrap gap-2.5"
            >
              <motion.button
                {...press}
                type="button"
                onClick={() => setConfirmed(true)}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[14px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                <Check className="h-4 w-4" />
                Yes, that&apos;s right
              </motion.button>
              <motion.button
                {...press}
                type="button"
                onClick={() => router.push(correctBackHref)}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-[14px] font-semibold text-foreground hover:border-muted-foreground/30"
              >
                <Pencil className="h-4 w-4" />
                Actually, let me fix something
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="after"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="flex flex-col gap-3"
            >
              <Bubble>
                <p className="mb-1.5 font-semibold text-[13px] text-muted-foreground">Before we go any further:</p>
                <ul className="flex flex-col gap-1.5">
                  {THE_PROMISE.map((line, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-[3px] text-primary">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </Bubble>
              <Bubble>
                For now, everything I do goes through you first — you&apos;ll see every reply before it sends. As you
                get to know how I work, you can hand me more.
              </Bubble>
              <div className={cn("mt-2")}>
                <Button onClick={() => router.push("/dashboard")} variant="primary" size="lg">
                  Sounds good — take me to Front Desk
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
