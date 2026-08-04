"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
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

/** Matches one of the exact words in the eyebrow line below — the
 * mechanism the trade-highlight (§8 of this review) is built on. */
type Trade = "plumbers" | "electricians" | "builders" | "roofers" | "painters";

interface ConversationStory {
  businessName: string;
  trade: Trade;
  exchanges: readonly [Exchange, Exchange];
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

/** One story's own conversation, playing once from the top on mount.
 * The phone frame itself is now a fixed size (`DeviceFrame`); this
 * scrolls its own message thread inside that fixed frame rather than
 * growing it, and keeps the thread scrolled to the newest message. */
function StoryConversation({ story }: { story: ConversationStory }) {
  const [visibleCount, setVisibleCount] = useState(0);
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
    }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleCount]);

  return (
    <PhoneFrame
      businessName={story.businessName}
      scrollable
      bodyRef={bodyRef}
      className="h-full w-full rounded-none border-0 shadow-none"
    >
      {story.exchanges.slice(0, visibleCount).map((exchange, i) => (
        <div key={i}>
          <Bubble from="customer">{exchange.customer}</Bubble>
          <TypedReply text={exchange.reply} />
        </div>
      ))}
    </PhoneFrame>
  );
}

function AutoConversation({ story, storyIndex }: { story: ConversationStory; storyIndex: number }) {
  return (
    <div>
      <div className="relative mx-auto max-w-[400px]">
        {/* The one focal glow — a single soft light source behind the
         * phone, static rather than animated (the phone's own slow
         * float below is already the one thing that moves here). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(37,99,235,0.18), rgba(34,197,94,0.11) 55%, transparent 75%)" }}
        />
        <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}>
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

export function Hero() {
  const router = useRouter();
  const storyIndex = useRotatingStoryIndex();
  const story = STORIES[storyIndex]!;

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
        <TradeEyebrow activeTrade={story.trade} />

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
          ReplyFlow answers your{" "}
          <span className="font-semibold text-foreground">WhatsApp while you work</span> — and actually{" "}
          <span className="font-semibold text-foreground">knows your business</span>, not just how to chat.
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
            onClick={() => router.push("/signup")}
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
