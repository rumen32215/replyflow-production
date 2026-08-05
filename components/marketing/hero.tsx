"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { EASE } from "@/components/shared/motion";
import { GradientText } from "@/components/shared/gradient-text";
import { useLaunchTransition, TRANSITION_NAVIGATE_MS } from "@/components/shared/page-transition";
import { HeroPhone, HERO_PHONE_INITIAL_TRADE, type Trade } from "@/components/marketing/hero-phone";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";
import { cn } from "@/lib/utils";

/**
 * Landing Experience, Section 1 — Hero (`DOCS/SPECS/ReplyFlow-Landing-
 * Experience-Design.md` §2, `DOCS/SPECS/ReplyFlow-Visual-Language.md`).
 *
 * V13 founder review (2026-08-04) — architectural, not polish: "We're
 * no longer designing slides. We're designing one continuous product
 * experience." The entire "living phone" system (glow, journey data,
 * dashboard/conversation/photo acts, drag/dots) moved out to
 * `hero-phone.tsx` — this file is now only headline, eyebrow, CTA, and
 * trust copy, plus the small bridge (`activeTrade` state, set via
 * `HeroPhone`'s `onActiveTradeChange` callback) that lets the eyebrow
 * line above still highlight whichever trade the phone is currently
 * telling. Was one 1080-line file doing two real jobs (marketing copy
 * and a product-demo engine); now two files each doing one.
 */

const EYEBROW_TRADES: readonly Trade[] = ["plumbers", "electricians", "builders", "roofers", "painters"] as const;

/** The eyebrow line, with the trade matching whatever the phone is
 * currently telling quietly carrying more weight than the rest — ties
 * the claim ("for plumbers, electricians...") to the real, specific
 * example playing below it, without a new UI element.
 *
 * V9 founder review (2026-08-04): "the goal is not to make them
 * larger or louder... a tiny moment of recognition... the visitor
 * should instantly recognise 'this is for me' without consciously
 * noticing an animation happened." The colour crossfade alone read as
 * an animation playing; pairing it with a small, non-animating weight
 * step (font-bold → font-extrabold, a state, not a tween) gives the
 * active word more quiet confidence without adding any more motion to
 * notice — the eye registers "that word is stronger" before it ever
 * registers "something moved." */
function TradeEyebrow({ activeTrade }: { activeTrade: Trade }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="mb-5 text-[13px] font-bold uppercase tracking-widest"
    >
      {/* V17 founder review (2026-08-04) — release-candidate audit:
       * measured contrast of `text-primary` at the opacities this line
       * previously used (`/55`–`/60`) against this page's light
       * background comes out around 2.5–3.8:1 — well under WCAG AA's
       * 4.5:1 minimum for 13px text, and primary blue needs ~95%+
       * opacity on this background to clear 4.5:1 at all, which would
       * have erased the hierarchy this eyebrow depends on. Fixed with
       * a real colour swap instead of a faded one: inactive words (and
       * "For") now use `text-foreground/70` (measured ~6.5:1, a clear
       * AA pass with real margin) rather than a washed-out primary —
       * the active word popping in full-saturation blue reads even
       * more clearly against that quiet near-black than it did against
       * a lighter tint of its own colour. */}
      <span className="text-foreground/70">For </span>
      {EYEBROW_TRADES.map((trade, i) => (
        <span key={trade}>
          <span
            className={cn(
              "inline-block",
              trade === activeTrade ? "font-extrabold text-primary" : "font-bold text-foreground/70"
            )}
          >
            {trade}
          </span>
          {i < EYEBROW_TRADES.length - 1 && (
            <span className="text-foreground/70">{i === EYEBROW_TRADES.length - 2 ? " & " : ", "}</span>
          )}
        </span>
      ))}
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
  { text: "Never miss another job because you were up a ladder.", emphasis: "up a ladder" },
  { text: "Never lose another customer because you couldn't answer.", emphasis: "couldn't answer" },
  { text: "Your customers never know you're busy.", emphasis: "never know" },
  { text: "Your business keeps moving while you work.", emphasis: "keeps moving" },
  { text: "Every message gets handled.", emphasis: "handled" },
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
  const router = useRouter();
  const [activeTrade, setActiveTrade] = useState<Trade>(HERO_PHONE_INITIAL_TRADE);
  const headlineIndex = useRotatingHeadlineIndex();
  const headline = HEADLINES[headlineIndex]!;
  const launchTransition = useLaunchTransition();
  const [isNavigating, setIsNavigating] = useState(false);

  // Prefetched as soon as the Hero mounts, not on click — a
  // `router.push` from a plain button (unlike `<Link>`) never
  // prefetches on its own. Confirmed live: without this, the eventual
  // mount could lag noticeably behind the overlay's own timing,
  // undermining the whole point of masking the swap.
  useEffect(() => {
    router.prefetch("/hire");
  }, [router]);

  // V7 founder review (2026-08-04): the transition now expands from
  // wherever the CTA actually sits on screen — a literal "CTA
  // expansion" — rather than always from the viewport's bottom
  // centre, and lives in the shared, cross-route `PageTransitionProvider`
  // (root layout) so it survives the navigation instead of unmounting
  // with Hero and cutting hard to the new page.
  //
  // V19 — this is the one genuine fresh-start point in the whole
  // product (`DOCS/CONSTITUTION/16...md` §0, `.../15...md` §7): nobody
  // clicks this CTA mid-flow, so it's the only safe place to reset the
  // onboarding store. `hiring-conversation.tsx` itself just hydrates
  // from whatever the store already holds, so leaving `/hire` and
  // coming back never loses an answer the way resetting on every
  // mount would have.
  function handleMeetReceptionist(e: React.MouseEvent<HTMLButtonElement>) {
    if (isNavigating) return;
    setIsNavigating(true);
    useOnboardingStore.getState().reset();
    const rect = e.currentTarget.getBoundingClientRect();
    launchTransition({
      x: ((rect.left + rect.width / 2) / window.innerWidth) * 100,
      y: ((rect.top + rect.height / 2) / window.innerHeight) * 100,
    });
    setTimeout(() => router.push("/hire"), TRANSITION_NAVIGATE_MS);
  }

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
        <TradeEyebrow activeTrade={activeTrade} />

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

        {/* V10 founder review (2026-08-04): explicitly asked as a
         * design judgement, not an instruction — "is 'Meet your
         * receptionist' appearing at the moment a visitor naturally
         * wants to act?" Reviewed and left exactly where it is —
         * already sits at the first natural decision point, matching
         * the standard high-converting shape (Linear, Stripe, Apple
         * product pages all keep a primary CTA in the hero, with
         * supporting proof below). */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.65 }}
          className="mt-9"
        >
          {/* The same premium motion language onboarding's own primary
           * CTA uses (`components/onboarding/onboarding-cta.tsx`) — the
           * identical spring and light-sweep values, sized for the
           * Hero rather than a full-width onboarding card. */}
          <motion.button
            type="button"
            onClick={handleMeetReceptionist}
            whileHover={isNavigating ? undefined : { y: -2 }}
            whileTap={isNavigating ? undefined : { scale: 0.985 }}
            animate={{ scale: isNavigating ? 1.06 : 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 24 }}
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-primary px-7 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-sm transition-shadow duration-300 hover:shadow-[0_10px_30px_-8px_rgba(37,99,235,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
          >
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-1/4 -skew-x-[20deg] bg-gradient-to-r from-transparent via-white/25 to-transparent"
              initial={{ x: "-140%" }}
              animate={{ x: "440%" }}
              transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 3.2 }}
            />
            <span className="relative z-10 flex items-center gap-2">
              Meet your receptionist
              <ArrowRight aria-hidden className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-1" />
            </span>
          </motion.button>

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
          <HeroPhone onActiveTradeChange={setActiveTrade} />
        </motion.div>
      </div>
    </section>
  );
}
