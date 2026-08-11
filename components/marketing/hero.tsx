"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { EASE } from "@/components/shared/motion";
import { GradientText } from "@/components/shared/gradient-text";
import { HeroPhone } from "@/components/marketing/hero-phone";

/**
 * Landing Experience, Section 1 — Hero (`DOCS/SPECS/ReplyFlow-Landing-
 * Experience-Design.md` §2, `DOCS/SPECS/ReplyFlow-Visual-Language.md`).
 *
 * V13 founder review (2026-08-04) — architectural, not polish: "We're
 * no longer designing slides. We're designing one continuous product
 * experience." The entire "living phone" system (glow, journey data,
 * dashboard/conversation/photo acts, drag/dots) moved out to
 * `hero-phone.tsx` — this file is now only headline, eyebrow, CTA, and
 * trust copy. Was one 1080-line file doing two real jobs (marketing
 * copy and a product-demo engine); now two files each doing one.
 *
 * ReplyFlow V2 (2026-08-11): repositioned to UK plumbers only — the
 * rotating five-trade eyebrow (and the `activeTrade` bridge that kept
 * it in sync with whichever trade the phone was telling) is gone,
 * since promising five trades here while the AI's own intake
 * intelligence (`lib/trades.ts`) is only genuinely built for plumbing
 * was a real promise/delivery mismatch, not a stylistic choice. One
 * static line, same visual slot and weight the active word used to
 * get.
 */
function PlumbingEyebrow() {
  return (
    <motion.p
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="mb-5 text-[13px] font-bold uppercase tracking-widest"
    >
      {/* Same contrast fix this line has carried since the V17
       * founder review (2026-08-04): `text-foreground/70` for the
       * quiet half of the line (~6.5:1, a clear WCAG AA pass),
       * full-saturation `text-primary` for the half that should carry
       * weight — not a faded tint, which measured 2.5–3.8:1 here and
       * failed AA outright. */}
      <span className="text-foreground/70">For </span>
      <span className="font-extrabold text-primary">UK plumbers</span>
    </motion.p>
  );
}

const TRIAL_POINTS = ["7 days free", "No card needed", "No commitment"] as const;

/** Several pre-written statements, same emotional register as the
 * original ("up a ladder") — sixth founder review (2026-08-04) asked
 * for the headline itself to rotate via crossfade, not typing, kept
 * to a handful so it reads as considered rather than gimmicky. Each
 * names the substring `Headline` should carry through `GradientText`. */
interface Headline {
  text: string;
  emphasis: string;
}

const HEADLINES: readonly Headline[] = [
  { text: "Never miss another job because you were under a sink.", emphasis: "under a sink" },
  { text: "Never lose another customer because you couldn't answer.", emphasis: "couldn't answer" },
  { text: "Your customers never know you're mid-job.", emphasis: "mid-job" },
  { text: "Your business keeps moving while you're on the tools.", emphasis: "on the tools" },
  { text: "Every WhatsApp enquiry gets handled.", emphasis: "handled" },
  { text: "Your receptionist never takes a day off.", emphasis: "day off" },
] as const;

const HEADLINE_INTERVAL_MS = 5200;

/** Sequential, not random — the order itself never changes, so the
 * first render is identical on server and client and there's no
 * `Math.random()`-in-`useState` hydration risk to avoid here at all.
 * Real `setInterval`-with-cleanup, the correct convention for a
 * genuinely long-lived effect. */
function useRotatingHeadlineIndex(): number {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // Eighth founder review (2026-08-04): "every single refresh" opened
    // on the same headline, which "immediately makes the rotation feel
    // fake." Deterministic first render (index 0, both server and the
    // client's first paint), then this effect immediately picks a real
    // random starting point before the interval takes over.
    let current = Math.floor(Math.random() * HEADLINES.length);
    setIndex(current);

    const id = setInterval(() => {
      current = (current + 1) % HEADLINES.length;
      setIndex(current);
    }, HEADLINE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return index;
}

/** A `background-clip: text` gradient recalculates per line box, so a
 * multi-word emphasis phrase that happens to wrap mid-phrase (confirmed
 * live: "couldn't" / "answer" landing on separate lines at desktop
 * width) rendered as one flat colour per line instead of one smooth
 * sweep — reading as two disconnected colours, not one considered
 * accent. `whitespace-nowrap` on the emphasis span doesn't stop the
 * phrase from wrapping to the next line when it needs to (the browser
 * can still break immediately before/after a nowrap span) — it only
 * stops it from splitting internally, so the gradient is always one
 * continuous sweep across the whole phrase, on whichever line it
 * lands. */
function HeadlineText({ headline }: { headline: Headline }) {
  const start = headline.text.indexOf(headline.emphasis);
  const before = headline.text.slice(0, start);
  const after = headline.text.slice(start + headline.emphasis.length);
  return (
    <>
      {before}
      <GradientText className="whitespace-nowrap">{headline.emphasis}</GradientText>
      {after}
    </>
  );
}

export function Hero() {
  const headlineIndex = useRotatingHeadlineIndex();
  const headline = HEADLINES[headlineIndex]!;

  return (
    <section className="relative overflow-hidden">
      {/* Ambient atmosphere only — the one motion purpose that doesn't
       * carry information (Visual Language §7 category 4). Identical
       * primitive already used on Front Desk's own arrival moment. */}
      <div className="aurora-layer" aria-hidden="true">
        <div className="aurora-blob aurora-blob-primary" />
        <div className="aurora-blob aurora-blob-success" />
      </div>

      <div className="relative mx-auto max-w-3xl px-6 pt-8 text-center sm:pt-14 lg:pt-16">
        <PlumbingEyebrow />

        <motion.div layout transition={{ duration: 0.4, ease: EASE }}>
          <AnimatePresence mode="wait">
            <motion.h1
              key={headlineIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="text-[34px] font-extrabold leading-[1.12] tracking-tight sm:text-[44px] lg:text-[52px]"
            >
              <HeadlineText headline={headline} />
            </motion.h1>
          </AnimatePresence>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.4 }}
          className="mx-auto mt-6 max-w-[42ch] text-[17px] leading-relaxed text-muted-foreground sm:text-[18px]"
        >
          Every WhatsApp message gets a reply{" "}
          <span className="font-semibold text-foreground">you&apos;d actually send</span>.
        </motion.p>

        {/* V8 architectural reset (2026-08-06): the hero CTA is removed
         * entirely — the receptionist creation experience now begins
         * lower on the page, inside "How your business stays organised"
         * (`peace-of-mind.tsx`), not here. Trust points stay exactly
         * where they were; only the button above them is gone. */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.65 }}
          className="mt-9"
        >
          {/* One row at every breakpoint, never `flex-wrap` — mobile
           * earns that by getting its own tighter type/badge/gap sizing
           * rather than by giving up the single line; `sm:` and up
           * steps back up to the original sizing. */}
          <div className="mt-4 flex items-center justify-center gap-x-2 gap-y-1.5 sm:gap-x-4">
            {TRIAL_POINTS.map((point, i) => (
              <motion.span
                key={point}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE, delay: 0.85 + i * 0.1 }}
                className="flex items-center gap-1 text-[11.5px] font-medium text-foreground/80 sm:gap-1.5 sm:text-[13.5px]"
              >
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-success/15 sm:h-4 sm:w-4" aria-hidden>
                  <Check className="h-2 w-2 text-success sm:h-2.5 sm:w-2.5" strokeWidth={3.5} />
                </span>
                {point}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* The enlarged mood glow inside `HeroPhone` bleeds down into
       * this space (rather than stopping dead at the phone's edge),
       * so the section ends with the current act's own colour still
       * fading out, not a hard cut to nothing. */}
      <div className="relative mx-auto mt-16 max-w-[560px] px-6 pb-12 sm:mt-20 sm:pb-16 lg:mt-24 lg:max-w-[640px] lg:pb-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.9 }}
        >
          <HeroPhone />
        </motion.div>
      </div>
    </section>
  );
}
