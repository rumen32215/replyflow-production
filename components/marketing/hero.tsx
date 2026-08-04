"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Check,
  AlertTriangle,
  ClipboardCheck,
  CalendarCheck,
  Clock,
  UserPlus,
  Bell,
} from "lucide-react";
import { EASE } from "@/components/shared/motion";
import { GradientText } from "@/components/shared/gradient-text";
import { PhoneFrame, Bubble } from "@/components/shared/phone-preview";
import { TypingDots, useTypedMessage } from "@/components/shared/typed-message";
import { DeviceFrame } from "@/components/marketing/device-frame";
import { cn } from "@/lib/utils";

/**
 * Landing Experience, Section 1 — Hero (`DOCS/SPECS/ReplyFlow-Landing-
 * Experience-Design.md` §2, `DOCS/SPECS/ReplyFlow-Visual-Language.md`).
 *
 * Fourth founder review (2026-08-04) — enhancement, not a redesign.
 * The conversation-typing mechanism, the four-story library, and the
 * random-then-rotating selection are unchanged (all praised directly
 * — "keep that"). What changed: the device is now a fixed physical
 * object (see `device-frame.tsx`'s own note on why), a handful of
 * carefully chosen words carry real emphasis instead of the whole
 * paragraph reading as one grey block, the trial line reads as
 * reassurance instead of small print, and the eyebrow line quietly
 * names which trade is currently on screen — a small, considered
 * addition (not a new feature) that ties "for plumbers, electricians,
 * builders, roofers & painters" to the real, specific example playing
 * below it.
 */

interface Exchange {
  customer: string;
  reply: string;
}

/** What the conversation quietly leaves behind once it settles — the
 * fixed-height screen (`device-frame.tsx`) has real empty space below
 * a two-exchange thread; fifth founder review (2026-08-04) asked for
 * that space to show the product actually working, not sit blank. One
 * per story, each a real, accurate downstream outcome of that exact
 * conversation (a Work Card, an escalation flag, a diary booking) —
 * never an invented capability.
 *
 * Seventh founder review (2026-08-04): these all looked "almost
 * identical" — a real product surfaces different kinds of outcomes
 * with real visual hierarchy (Linear/Stripe/Apple notification
 * language), not one generic green success box repeated. `kind` picks
 * both the icon and the accent colour from `MOMENT_STYLES` below. */
interface ProductMoment {
  text: string;
  kind: "job" | "booking" | "scheduled" | "customer" | "urgent" | "team";
}

/** Matches one of the exact words in the eyebrow line below — the
 * mechanism the trade-highlight (§8 of this review) is built on. */
type Trade = "plumbers" | "electricians" | "builders" | "roofers" | "painters";

interface ConversationStory {
  businessName: string;
  trade: Trade;
  exchanges: readonly [Exchange, Exchange];
  /** Sixth founder review (2026-08-04): "demonstrate a workflow, not
   * only a conversation" — two sequential outcomes, not one, so the
   * settled phone reads as ReplyFlow actually running the business
   * behind the scenes rather than a single static confirmation. */
  productMoments: readonly [ProductMoment, ProductMoment];
}

const STORIES: readonly ConversationStory[] = [
  {
    businessName: "Dean's Plumbing",
    trade: "plumbers",
    exchanges: [
      {
        customer: "Hi, my kitchen tap's been dripping non-stop since this morning — any chance someone can look today?",
        reply: "That's an easy one for us — no call-out fee for a job like that. I've got a slot at 4pm today, would that work?",
      },
      {
        customer: "Perfect. Quick one — will it be Dean again? He did our bathroom last year.",
        reply: "It will, yeah — I'll let him know it's a repeat visit. See you at 4.",
      },
    ],
    productMoments: [
      { text: "Job card created — kitchen tap, 4:00pm", kind: "job" },
      { text: "Added to today's schedule", kind: "scheduled" },
    ],
  },
  {
    businessName: "Harris Electrical",
    trade: "electricians",
    exchanges: [
      {
        customer: "Hi, roughly how much would it be to add a couple of extra sockets in the kitchen?",
        reply: "Depends a bit on the wiring run, so I don't want to guess at it — I'll get one of the team to call and give you a proper price. Does this afternoon work?",
      },
      {
        customer: "Yeah, that's fine.",
        reply: "Great — they'll ring you on this number in the next hour or so.",
      },
    ],
    productMoments: [
      { text: "Callback reminder set for this afternoon", kind: "scheduled" },
      { text: "Customer added to follow-ups", kind: "customer" },
    ],
  },
  {
    businessName: "Ridgeline Roofing",
    trade: "roofers",
    exchanges: [
      {
        customer: "A few tiles came off in last night's wind — there's water coming into the loft now.",
        reply: "That's worth getting looked at today — I'm letting the team know right now, someone will call you shortly to sort a time.",
      },
      {
        customer: "Thanks, really appreciate it.",
        reply: "No problem — if you can, keep something under the leak until then.",
      },
    ],
    productMoments: [
      { text: "Flagged for you — urgent, water ingress", kind: "urgent" },
      { text: "Team notified immediately", kind: "team" },
    ],
  },
  {
    businessName: "Bell & Co Decorators",
    trade: "painters",
    exchanges: [
      {
        customer: "Hi, do you have anyone free to repaint a bedroom this week?",
        reply: "We do — Thursday or Friday both work. Which's better for you?",
      },
      {
        customer: "Thursday's perfect.",
        reply: "Brilliant, I'll get that booked in for Thursday.",
      },
    ],
    productMoments: [
      { text: "Booking added — Thursday", kind: "booking" },
      { text: "Schedule updated", kind: "scheduled" },
    ],
  },
] as const;

const EYEBROW_TRADES: readonly Trade[] = ["plumbers", "electricians", "builders", "roofers", "painters"] as const;

/** Mirrors `preparing-receptionist.tsx`'s own pacing formula. */
function estimateTypeMs(text: string): number {
  return 150 + 520 + Math.min(1500, Math.max(650, text.length * 14));
}

function estimateStoryMs(story: ConversationStory): number {
  return 900 + estimateTypeMs(story.exchanges[0].reply) + 1300 + estimateTypeMs(story.exchanges[1].reply);
}

/** How long a finished conversation rests, fully settled, before the
 * next one quietly begins — long enough to actually read it. */
const REST_MS = 6500;

function pickNextIndex(current: number): number {
  if (STORIES.length <= 1) return 0;
  let next = Math.floor(Math.random() * STORIES.length);
  while (next === current) next = Math.floor(Math.random() * STORIES.length);
  return next;
}

/**
 * Rotates through `STORIES` for as long as the visitor is on the page.
 * Deterministic on the first render on purpose — `Math.random()`
 * inside a `useState` initializer runs once on the server and again
 * on the client during hydration and the two will always disagree,
 * which React correctly reports as a real content mismatch (caught
 * the hard way, via a real hydration error, in the previous pass).
 * The actual random pick happens in the effect below, client-only,
 * after hydration is already done.
 *
 * Uses real `cancelled`-on-cleanup, deliberately the opposite
 * convention from each individual conversation's own one-shot
 * sequence below — the correct idiom for a genuinely long-lived
 * effect, which self-heals correctly under React Strict Mode's
 * dev-only double-invoke (the throwaway first instance is cancelled
 * before its first await resolves; the second runs forward normally).
 */
function useRotatingStoryIndex(): number {
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    async function loop() {
      const initial = Math.floor(Math.random() * STORIES.length);
      indexRef.current = initial;
      setIndex(initial);

      while (!cancelled) {
        await wait(estimateStoryMs(STORIES[indexRef.current]!) + REST_MS);
        if (cancelled) return;
        const next = pickNextIndex(indexRef.current);
        indexRef.current = next;
        setIndex(next);
      }
    }
    void loop();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return index;
}

/** Fresh mount per exchange — identical convention to `preparing-
 * receptionist.tsx`'s own `TypedReply`. */
function TypedReply({ text }: { text: string }) {
  const { display, isThinking } = useTypedMessage(text);
  return (
    <Bubble from="receptionist" className="min-h-[34px]">
      {isThinking || display.length === 0 ? <TypingDots className="px-1 py-1" /> : <span>{display}</span>}
    </Bubble>
  );
}

/** Icon + accent per moment `kind` — real hierarchy instead of one
 * repeated green box (seventh founder review, 2026-08-04, "think
 * Linear, Stripe, Apple — not generic green success boxes"). Tailwind
 * needs statically-written class names to find them at build time, so
 * this is a lookup table, never a template-string colour name. */
const MOMENT_STYLES: Record<
  ProductMoment["kind"],
  { icon: typeof ClipboardCheck; badge: string; icon_: string }
> = {
  job: { icon: ClipboardCheck, badge: "bg-success/15", icon_: "text-success" },
  booking: { icon: CalendarCheck, badge: "bg-primary/15", icon_: "text-primary" },
  scheduled: { icon: Clock, badge: "bg-learning/15", icon_: "text-learning" },
  customer: { icon: UserPlus, badge: "bg-success/15", icon_: "text-success" },
  urgent: { icon: AlertTriangle, badge: "bg-attention/20", icon_: "text-attention" },
  team: { icon: Bell, badge: "bg-primary/15", icon_: "text-primary" },
};

/** The settled-conversation reveal — a system moment, not another
 * chat bubble, so it never reads as something either party "said."
 * `urgent` gets a visibly heavier treatment (tinted card, coloured
 * border) than the routine confirmations — "some should feel more
 * important than others," not every outcome carrying equal weight. */
function ProductMomentCard({ moment }: { moment: ProductMoment }) {
  const { icon: Icon, badge, icon_ } = MOMENT_STYLES[moment.kind];
  const isUrgent = moment.kind === "urgent";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: EASE }}
      className={cn(
        "mx-auto flex max-w-[88%] items-center gap-2.5 rounded-xl border px-3 py-2 text-[12px] font-semibold shadow-sm backdrop-blur-sm",
        isUrgent ? "border-attention/30 bg-attention/[0.08] text-attention" : "border-border/60 bg-white/90 text-foreground"
      )}
    >
      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg", badge)}>
        <Icon className={cn("h-3.5 w-3.5", icon_)} strokeWidth={2.5} />
      </span>
      {moment.text}
    </motion.div>
  );
}

/** How long the finished thread rests before the first product moment
 * quietly appears beneath it — long enough to read as "after," not
 * "during" — and the pause between the first and second moment, short
 * enough to read as one continuous process rather than two unrelated
 * events. */
const PRODUCT_MOMENT_DELAY_MS = 900;
const PRODUCT_MOMENT_STEP_MS = 1100;

/** One story's own conversation, playing once from the top on mount.
 * The phone frame itself is now a fixed size (`DeviceFrame`); this
 * scrolls its own message thread inside that fixed frame rather than
 * growing it, and keeps the thread scrolled to the newest message.
 * Once the last reply has finished typing, the fixed screen's
 * remaining empty space reveals what that conversation set in motion
 * — two sequential outcomes, not one, so it reads as ReplyFlow
 * actually running a small workflow rather than a single static
 * confirmation (sixth founder review, 2026-08-04). */
function StoryConversation({ story }: { story: ConversationStory }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [momentCount, setMomentCount] = useState(0);
  const startedRef = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // No cleanup here, deliberately — combining this ref guard with a
    // cancellation flag breaks under Strict Mode for a short, bounded
    // sequence like this one (see `useRotatingStoryIndex` above for
    // the opposite, correct convention for a genuinely long-lived one).
    if (startedRef.current) return;
    startedRef.current = true;
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    async function run() {
      await wait(900);
      for (let i = 0; i < story.exchanges.length; i++) {
        if (i > 0) await wait(1300);
        setVisibleCount(i + 1);
        await wait(estimateTypeMs(story.exchanges[i]!.reply));
      }
      await wait(PRODUCT_MOMENT_DELAY_MS);
      setMomentCount(1);
      await wait(PRODUCT_MOMENT_STEP_MS);
      setMomentCount(2);
    }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleCount, momentCount]);

  return (
    <PhoneFrame
      businessName={story.businessName}
      scrollable
      bodyRef={bodyRef}
      headerInsetTop
      className="h-full w-full rounded-none border-0 shadow-none"
    >
      {story.exchanges.slice(0, visibleCount).map((exchange, i) => (
        <div key={i}>
          <Bubble from="customer">{exchange.customer}</Bubble>
          <TypedReply text={exchange.reply} />
        </div>
      ))}
      {momentCount > 0 && (
        <div className="space-y-1.5 pt-2">
          {story.productMoments.slice(0, momentCount).map((moment, i) => (
            <ProductMomentCard key={i} moment={moment} />
          ))}
        </div>
      )}
    </PhoneFrame>
  );
}

function AutoConversation({ story, storyIndex }: { story: ConversationStory; storyIndex: number }) {
  return (
    <div>
      <div className="relative mx-auto max-w-[340px]">
        {/* The one focal glow — a single soft light source behind the
         * phone. Eighth founder review (2026-08-04): "subtle screen
         * glow" / "tiny shadow movement," Apple-subtle — tied to the
         * exact same float timing as the phone below so it reads as
         * one connected, alive object rather than a second, unrelated
         * animation. Sized to the phone's own correct proportions
         * rather than the old, too-wide footprint. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(37,99,235,0.18), rgba(34,197,94,0.11) 55%, transparent 75%)" }}
          animate={{ opacity: [0.85, 1, 0.85], scale: [1, 1.05, 1] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* A held-at-an-angle presentation, not dead-on — the single
         * biggest thing separating a photographed product shot from a
         * screenshot-in-a-frame (fifth founder review, 2026-08-04, a
         * real Apple Wallet promo card as the reference point). The
         * tilt is static at rest (`rotateY`/`rotateX` never change);
         * `y` floats continuously, and `rotateZ` mostly holds its
         * resting tilt too, except for a barely-there "idle vibration"
         * once every ~12s (eighth founder review — "almost impossible
         * to notice consciously, but enough that the page feels
         * alive") — most of each cycle sits flat, per `times`, with
         * only a brief jitter near the end. */}
        <motion.div
          initial={{ y: 0, rotateY: -9, rotateX: 3, rotateZ: -1 }}
          animate={{
            y: [0, -6, 0],
            rotateY: -9,
            rotateX: 3,
            rotateZ: [-1, -1, -1.6, -0.5, -1, -1],
          }}
          transition={{
            y: { duration: 4.2, repeat: Infinity, ease: "easeInOut" },
            rotateZ: {
              duration: 12,
              repeat: Infinity,
              ease: "easeInOut",
              times: [0, 0.65, 0.7, 0.76, 0.82, 1],
            },
          }}
          style={{ transformPerspective: 1300 }}
        >
          <DeviceFrame>
            <AnimatePresence mode="wait">
              <motion.div
                key={storyIndex}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.55, ease: EASE }}
                className="h-full"
              >
                <StoryConversation story={story} />
              </motion.div>
            </AnimatePresence>
          </DeviceFrame>
        </motion.div>
      </div>

      {/* No pronoun, no "taught her" — quiet confidence rather than an
       * explanation. Still honest that this is illustrative (Visual
       * Language §0.1), just said once, plainly. */}
      <p className="mt-5 text-center text-[12px] text-muted-foreground/70">
        How ReplyFlow replies — grounded in what&apos;s actually been taught, never guessed.
      </p>
    </div>
  );
}

/** The eyebrow line, with the trade matching whatever story is
 * currently on screen quietly carrying more weight than the rest —
 * ties the claim ("for plumbers, electricians...") to the real,
 * specific example playing below it, without a new UI element. */
function TradeEyebrow({ activeTrade }: { activeTrade: Trade | null }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="mb-5 text-[13px] font-bold uppercase tracking-widest"
    >
      <span className="text-primary/60">For </span>
      {EYEBROW_TRADES.map((trade, i) => (
        <span key={trade}>
          <span
            className={cn(
              "transition-colors duration-700",
              trade === activeTrade ? "text-primary" : "text-primary/60"
            )}
          >
            {trade}
          </span>
          {i < EYEBROW_TRADES.length - 1 && (
            <span className="text-primary/60">{i === EYEBROW_TRADES.length - 2 ? " & " : ", "}</span>
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
 * genuinely long-lived effect (see `useRotatingStoryIndex` above). */
function useRotatingHeadlineIndex(): number {
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);

  useEffect(() => {
    // Eighth founder review (2026-08-04): "every single refresh" opened
    // on the same headline, which "immediately makes the rotation feel
    // fake." Same deterministic-first-render, random-in-effect pattern
    // as `useRotatingStoryIndex` above — index 0 is what the server (and
    // the client, for one paint) renders, then this effect immediately
    // picks a real random starting point before the interval takes over.
    const initial = Math.floor(Math.random() * HEADLINES.length);
    indexRef.current = initial;
    setIndex(initial);

    const id = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % HEADLINES.length;
      setIndex(indexRef.current);
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
 * lands. (Each `HEADLINES` emphasis is kept short enough — a couple
 * of words — that "the whole phrase as one unbreakable unit" never
 * risks overflowing the narrowest, mobile, width.) */
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

/** How long the celebration plays before the actual navigation fires
 * — inside the founder's stated 400–700ms window. */
const CTA_TRANSITION_MS = 600;

/** Eighth founder review (2026-08-04): pressing "Meet your
 * receptionist" shouldn't just instantly swap to the sign-up page —
 * "a beautiful micro-celebration... like opening a premium Apple
 * application." A brand-gradient circle expands from the button's own
 * corner of the screen, a checkmark confirms, then the real
 * navigation fires underneath it — so whatever brief work Next does
 * to mount `/signup` is masked by an already-opaque, intentional
 * moment instead of being a blank flash. */
function CtaTransitionOverlay() {
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-primary to-success"
      initial={{ clipPath: "circle(0% at 50% 100%)" }}
      animate={{ clipPath: "circle(150% at 50% 100%)" }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      transition={{ duration: 0.55, ease: EASE }}
    >
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.22, duration: 0.3, ease: EASE }}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30"
      >
        <Check className="h-8 w-8 text-white" strokeWidth={3} />
      </motion.div>
    </motion.div>
  );
}

export function Hero() {
  const router = useRouter();
  const storyIndex = useRotatingStoryIndex();
  const story = STORIES[storyIndex]!;
  const headlineIndex = useRotatingHeadlineIndex();
  const headline = HEADLINES[headlineIndex]!;
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Prefetched as soon as the Hero mounts, not on click — a
  // `router.push` from a plain button (unlike `<Link>`) never
  // prefetches on its own. Confirmed live: without this, the eventual
  // `/signup` mount could lag noticeably behind the overlay's own
  // timing, undermining the whole point of masking the swap.
  useEffect(() => {
    router.prefetch("/signup");
  }, [router]);

  function handleMeetReceptionist() {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => router.push("/signup"), CTA_TRANSITION_MS);
  }

  return (
    <section className="relative overflow-hidden">
      <AnimatePresence>{isTransitioning && <CtaTransitionOverlay />}</AnimatePresence>

      {/* Ambient atmosphere only — the one motion purpose that doesn't
       * carry information (Visual Language §7 category 4). Identical
       * primitive already used on Front Desk's own arrival moment. */}
      <div className="aurora-layer" aria-hidden="true">
        <div className="aurora-blob aurora-blob-primary" />
        <div className="aurora-blob aurora-blob-success" />
      </div>

      <div className="relative mx-auto max-w-3xl px-6 pt-8 text-center sm:pt-14 lg:pt-16">
        <TradeEyebrow activeTrade={story.trade} />

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
          Every WhatsApp message gets a reply that{" "}
          <span className="font-semibold text-foreground">actually knows your business</span>.
        </motion.p>

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
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.985 }}
            transition={{ type: "spring", stiffness: 400, damping: 24 }}
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-primary px-7 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-sm transition-shadow duration-300 hover:shadow-[0_10px_30px_-8px_rgba(37,99,235,0.55)]"
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
              <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-1" />
            </span>
          </motion.button>

          {/* Reassurance, not small print — each point earns its own
           * quiet checkmark rather than reading as one line of legal
           * copy tacked under the button. */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
            {TRIAL_POINTS.map((point) => (
              <span key={point} className="flex items-center gap-1.5 text-[13.5px] font-medium text-foreground/80">
                <Check className="h-3.5 w-3.5 text-success" strokeWidth={3} />
                {point}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="relative mx-auto mt-16 max-w-[560px] px-6 pb-20 sm:mt-20 sm:pb-28 lg:pb-32">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.9 }}
        >
          <AutoConversation story={story} storyIndex={storyIndex} />
        </motion.div>
      </div>
    </section>
  );
}
