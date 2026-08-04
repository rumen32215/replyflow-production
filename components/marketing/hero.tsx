"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { useLaunchTransition, TRANSITION_NAVIGATE_MS } from "@/components/shared/page-transition";
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

/** V10 founder review (2026-08-04): "allow each story to have a
 * different emotional atmosphere... think cinematic lighting... never
 * recolour WhatsApp, never a gimmick." Purely an ambient glow *behind*
 * the phone (`MOOD_GLOW` in `AutoConversation` below) — the chrome,
 * bubbles and header stay exactly as they are for every story. */
type StoryMood = "green" | "blue" | "amber" | "teal";

interface ConversationStory {
  businessName: string;
  trade: Trade;
  mood: StoryMood;
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
    mood: "green",
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
      { text: "Confirmed the 4pm slot with the customer", kind: "job" },
      { text: "Diary updated automatically", kind: "scheduled" },
    ],
  },
  {
    businessName: "Harris Electrical",
    trade: "electricians",
    mood: "blue",
    exchanges: [
      {
        customer: "Hi, roughly how much would it be to add a couple of extra sockets in the kitchen?",
        reply: "For two extra sockets on an easy day-time job, that's normally around £180 including parts. Want me to pencil in a time?",
      },
      {
        customer: "Yeah go on then, when's the next slot?",
        reply: "I've got Wednesday at 10am free — I'll get that booked in for you.",
      },
    ],
    productMoments: [
      { text: "Quote sent — grounded in your pricing rules", kind: "job" },
      { text: "Wednesday 10am added to the diary", kind: "scheduled" },
    ],
  },
  {
    businessName: "Ridgeline Roofing",
    trade: "roofers",
    mood: "amber",
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
      { text: "Recognised as urgent — water ingress", kind: "urgent" },
      { text: "Team alerted without waiting to be asked", kind: "team" },
    ],
  },
  {
    businessName: "Whitmore Building Co",
    trade: "builders",
    mood: "teal",
    exchanges: [
      {
        customer: "Just sent a couple of photos over — there's a crack running right across the bedroom ceiling, want to make sure it's not serious.",
        reply: "Got them, thanks — that's worth a proper look rather than guessing over text. I can get someone round Thursday morning, does that work?",
      },
      {
        customer: "Thursday's good, morning's better for me anyway.",
        reply: "Perfect, I'll pencil that in — bring the photos up when they visit so nothing's missed.",
      },
    ],
    productMoments: [
      { text: "Booked in for a proper look — Thursday morning", kind: "job" },
      { text: "Diary updated automatically", kind: "scheduled" },
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

interface StoryController {
  index: number;
  goTo: (i: number) => void;
  next: () => void;
  prev: () => void;
}

/**
 * V8 founder review (2026-08-04): "the phone should no longer behave
 * like a looping animation... a tiny version of ReplyFlow users can
 * explore." Auto-rotation alone reads as a slideshow; this hook keeps
 * the same natural cadence (watch one story, wait, move to the next)
 * but exposes `goTo`/`next`/`prev` so a swipe or a tapped dot can jump
 * immediately — and, deliberately, whatever the visitor jumps to
 * becomes the new anchor the auto-advance clock counts on next,
 * rather than fighting them or resetting to some fixed point. Explore
 * it and it keeps exploring with you; leave it alone and it keeps
 * playing on its own.
 *
 * Always opens on `STORIES[0]` (V10, see the mount effect below) —
 * deterministic on both the server and the first client render, so
 * there's nothing here for hydration to disagree about even though
 * the value is also set again, identically, client-side.
 *
 * Real `clearTimeout`-on-cleanup, the correct idiom for a genuinely
 * long-lived effect — self-heals correctly under React Strict Mode's
 * dev-only double-invoke (the throwaway first instance's pending
 * timeout is cleared before it can fire; the second schedules its own
 * and runs forward normally).
 */
function useInteractiveStoryIndex(): StoryController {
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNext = useCallback((fromIndex: number) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const upcoming = pickNextIndex(indexRef.current);
      indexRef.current = upcoming;
      setIndex(upcoming);
      scheduleNext(upcoming);
    }, estimateStoryMs(STORIES[fromIndex]!) + REST_MS);
  }, []);

  useEffect(() => {
    // V10 founder review (2026-08-04): "whenever someone first lands
    // on the page, always begin on slide one — not whichever slide
    // happened to be active previously." Reverses the earlier
    // random-start decision deliberately, not by accident — that
    // randomisation existed to stop the *headline* rotation from
    // ever feeling scripted on repeat visits, a genuinely different
    // problem from the phone's opener. Slide one (Dean's Plumbing —
    // the plainest, most universally-relatable booking) is now always
    // the first thing shown; auto-play (and any real variety a
    // visitor sees across repeat visits) still takes over from there.
    indexRef.current = 0;
    setIndex(0);
    scheduleNext(0);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [scheduleNext]);

  const goTo = useCallback(
    (i: number) => {
      const clamped = ((i % STORIES.length) + STORIES.length) % STORIES.length;
      indexRef.current = clamped;
      setIndex(clamped);
      scheduleNext(clamped);
    },
    [scheduleNext]
  );
  const next = useCallback(() => goTo(indexRef.current + 1), [goTo]);
  const prev = useCallback(() => goTo(indexRef.current - 1), [goTo]);

  return { index, goTo, next, prev };
}

/** Fresh mount per exchange — identical convention to `preparing-
 * receptionist.tsx`'s own `TypedReply`. `animateTicks` only turns on
 * once the message has actually finished typing (`!isBusy`) — a
 * message can't be "sent" while it's still being composed, so the
 * sent → delivered → read progression only ever starts at exactly the
 * moment that's true (V9 "message delivery behaviour"). */
function TypedReply({ text }: { text: string }) {
  const { display, isThinking, isBusy } = useTypedMessage(text);
  return (
    <Bubble from="receptionist" className="min-h-[34px] lg:text-[14px]" animateTicks={!isBusy}>
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
 * important than others," not every outcome carrying equal weight.
 *
 * V8 founder review (2026-08-04): "lightly interacting with
 * notifications" — a tactile hover/press response, not a new screen
 * to open. There's nothing further to reveal underneath (these are
 * illustrative, not real data), so the interaction is honestly just
 * that: it responds to touch, the way a real notification would. */
function ProductMomentCard({ moment }: { moment: ProductMoment }) {
  const { icon: Icon, badge, icon_ } = MOMENT_STYLES[moment.kind];
  const isUrgent = moment.kind === "urgent";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ scale: 1.025, y: -1 }}
      whileTap={{ scale: 0.965 }}
      transition={{ duration: 0.5, ease: EASE }}
      className={cn(
        "mx-auto flex max-w-[88%] cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-[12px] font-semibold shadow-sm backdrop-blur-sm transition-shadow duration-300 hover:shadow-md",
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
    // V9 "typing pauses, tiny response delays": a fixed wait every
    // time reads as a metronome the moment you watch it twice. A
    // small random jitter (never in a `useState` initializer — this
    // only ever runs client-side, after mount, so there's no
    // hydration mismatch to worry about) keeps every playthrough
    // slightly different, the way a real person's response time is.
    const jitter = (ms: number, spread: number) => ms + (Math.random() * spread * 2 - spread);

    async function run() {
      await wait(jitter(900, 150));
      for (let i = 0; i < story.exchanges.length; i++) {
        if (i > 0) await wait(jitter(1300, 250));
        setVisibleCount(i + 1);
        await wait(estimateTypeMs(story.exchanges[i]!.reply));
      }
      await wait(jitter(PRODUCT_MOMENT_DELAY_MS, 150));
      setMomentCount(1);
      await wait(jitter(PRODUCT_MOMENT_STEP_MS, 200));
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
          <Bubble from="customer" className="lg:text-[14px]">{exchange.customer}</Bubble>
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

/** Small dot pagination beneath the phone — the explicit signal that
 * there's more to see and it's the visitor's to control, the same
 * language Apple's own product pages use for "there's more here."
 * Doubles as a direct jump: tap a dot, land on that business. */
function StoryDots({ active, onSelect }: { active: number; onSelect: (i: number) => void }) {
  return (
    <div className="mt-4 flex items-center justify-center gap-2" role="tablist" aria-label="Choose a business to preview">
      {STORIES.map((s, i) => (
        <button
          key={s.businessName}
          type="button"
          role="tab"
          aria-selected={i === active}
          aria-label={`Show ${s.businessName}`}
          onClick={() => onSelect(i)}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            i === active ? "w-5 bg-primary" : "w-1.5 bg-primary/25 hover:bg-primary/40"
          )}
        />
      ))}
    </div>
  );
}

/** V10 founder review (2026-08-04): "make the battery believable...
 * slight variation between stories... never identical forever." One
 * fixed value per story (not a live drain simulation — that would be
 * a much bigger, noisier thing to build for something that "shouldn't
 * attract attention individually") so it's still fully deterministic
 * and hydration-safe, just no longer the same 100% every time. */
const BATTERY_BY_STORY: readonly number[] = [97, 94, 90, 86] as const;

/** Two-stop radial gradients, one per `StoryMood` — same structure as
 * the glow this replaces, only the colour changes. Kept as a lookup
 * table (never a template-string colour) for the same reason
 * `MOMENT_STYLES` above is one: it's the honest way to say "these are
 * the only four, deliberately," not an open palette. */
const MOOD_GLOW: Record<StoryMood, string> = {
  green: "radial-gradient(circle, rgba(34,197,94,0.20), rgba(34,197,94,0.08) 55%, transparent 75%)",
  blue: "radial-gradient(circle, rgba(37,99,235,0.20), rgba(37,99,235,0.08) 55%, transparent 75%)",
  amber: "radial-gradient(circle, rgba(245,158,11,0.22), rgba(245,158,11,0.08) 55%, transparent 75%)",
  teal: "radial-gradient(circle, rgba(20,184,166,0.20), rgba(20,184,166,0.08) 55%, transparent 75%)",
};

/** V8 founder review (2026-08-04): "no longer a looping animation —
 * a tiny version of ReplyFlow users can explore." A horizontal drag
 * on the phone itself, elastic and pinned back to centre (the phone
 * never actually travels — `dragConstraints={{left:0,right:0}}` — it
 * only resists and springs back), decides the next/previous story on
 * release. Paired with `StoryDots` below so the interaction is
 * discoverable even for a visitor who never tries dragging it. */
function AutoConversation({
  story,
  storyIndex,
  onNext,
  onPrev,
  onGoTo,
}: {
  story: ConversationStory;
  storyIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onGoTo: (i: number) => void;
}) {
  return (
    <div>
      <div className="relative mx-auto max-w-[340px] lg:max-w-[400px]">
        {/* The one focal glow — a single soft light source behind the
         * phone. Eighth founder review (2026-08-04): "subtle screen
         * glow" / "tiny shadow movement," Apple-subtle — tied to the
         * exact same float timing as the phone below so it reads as
         * one connected, alive object rather than a second, unrelated
         * animation. Sized to the phone's own correct proportions
         * rather than the old, too-wide footprint.
         *
         * V10 founder review (2026-08-04): "cinematic lighting... a
         * different emotional atmosphere per story, without
         * recolouring WhatsApp." All four mood glows are stacked and
         * always mounted; only their own opacity crossfades when the
         * active story changes (0.6s), while each one keeps breathing
         * independently underneath (the original 4.2s pulse) — the
         * same "crossfade two layers, don't try to interpolate a
         * gradient string" technique already used for the story
         * content itself, so switching moods is exactly as seamless
         * as switching stories. */}
        <div className="pointer-events-none absolute inset-0 -z-10 rounded-full blur-3xl" aria-hidden>
          {STORIES.map((s, i) => (
            <motion.div
              key={s.businessName}
              className="absolute inset-0 rounded-full"
              animate={{ opacity: i === storyIndex ? 1 : 0 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <motion.div
                className="h-full w-full rounded-full"
                style={{ background: MOOD_GLOW[s.mood] }}
                animate={{ opacity: [0.85, 1, 0.85], scale: [1, 1.05, 1] }}
                transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
          ))}
        </div>
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
         * only a brief jitter near the end. `drag="x"` layers on top
         * of that same element (V8) — Framer composes the drag offset
         * with the existing `animate` transforms rather than fighting
         * them, since they touch different transform properties. */}
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          whileDrag={{ scale: 0.985 }}
          onDragEnd={(_e, info) => {
            if (info.offset.x < -50 || info.velocity.x < -350) onNext();
            else if (info.offset.x > 50 || info.velocity.x > 350) onPrev();
          }}
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
          className="cursor-grab touch-pan-y active:cursor-grabbing"
        >
          <DeviceFrame battery={BATTERY_BY_STORY[storyIndex] ?? 97}>
            {/* V9 founder review (2026-08-04): "the black transition
             * between phone stories breaks immersion... no black
             * flashes, no obvious reset." Root cause was `mode="wait"`
             * — it fully unmounts the outgoing story, waits, then
             * mounts the incoming one, and during that gap *nothing*
             * is rendered inside the screen, exposing its own raw
             * `bg-black` (`device-frame.tsx`'s screen div). Removing
             * `mode="wait"` lets the two overlap: the outgoing story
             * fades out while the incoming one fades in on top of it,
             * both absolutely stacked so they occupy the same space —
             * every story shares the same wallpaper and header colour,
             * so the cross-blend never exposes anything but phone. */}
            <AnimatePresence initial={false}>
              <motion.div
                key={storyIndex}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="absolute inset-0 h-full w-full"
              >
                <StoryConversation story={story} />
              </motion.div>
            </AnimatePresence>
          </DeviceFrame>
        </motion.div>
      </div>

      <StoryDots active={storyIndex} onSelect={onGoTo} />

      {/* No pronoun, no "taught her" — quiet confidence rather than an
       * explanation. Still honest that this is illustrative (Visual
       * Language §0.1), just said once, plainly.
       *
       * V8 audit finding (2026-08-04): a first-time visitor could
       * plausibly read "Dean's Plumbing," "Harris Electrical" etc. as
       * real reference customers rather than examples — nothing near
       * the phone said otherwise, only the section below it did. One
       * small, explicit line closes that gap without undercutting the
       * demo itself. */}
      <p className="mt-3 text-center text-[12px] text-muted-foreground/70">
        How ReplyFlow replies — grounded in what&apos;s actually been taught, never guessed.
        <br />
        Example conversations, not real customers.
      </p>
    </div>
  );
}

/** The eyebrow line, with the trade matching whatever story is
 * currently on screen quietly carrying more weight than the rest —
 * ties the claim ("for plumbers, electricians...") to the real,
 * specific example playing below it, without a new UI element.
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
              // V10 founder review (2026-08-04): "the transition still
              // lingers slightly too long... 15-20% quicker, not
              // faster overall." 700ms → 575ms is an 18% cut — enough
              // to feel like a confident rotation rather than a wait,
              // without turning it into a genuinely fast animation.
              "inline-block transition-colors duration-[575ms] ease-out",
              trade === activeTrade ? "font-extrabold text-primary" : "font-bold text-primary/55"
            )}
          >
            {trade}
          </span>
          {i < EYEBROW_TRADES.length - 1 && (
            <span className="text-primary/55">{i === EYEBROW_TRADES.length - 2 ? " & " : ", "}</span>
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

export function Hero() {
  const router = useRouter();
  const { index: storyIndex, goTo, next, prev } = useInteractiveStoryIndex();
  const story = STORIES[storyIndex]!;
  const headlineIndex = useRotatingHeadlineIndex();
  const headline = HEADLINES[headlineIndex]!;
  const launchTransition = useLaunchTransition();
  const [isNavigating, setIsNavigating] = useState(false);

  // Prefetched as soon as the Hero mounts, not on click — a
  // `router.push` from a plain button (unlike `<Link>`) never
  // prefetches on its own. Confirmed live: without this, the eventual
  // `/signup` mount could lag noticeably behind the overlay's own
  // timing, undermining the whole point of masking the swap.
  useEffect(() => {
    router.prefetch("/signup");
  }, [router]);

  // V7 founder review (2026-08-04): the transition now expands from
  // wherever the CTA actually sits on screen — a literal "CTA
  // expansion" — rather than always from the viewport's bottom
  // centre, and lives in the shared, cross-route `PageTransitionProvider`
  // (root layout) so it survives the `/signup` navigation instead of
  // unmounting with Hero and cutting hard to the new page.
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

        {/* V9 founder review (2026-08-04): "now feels like the weakest
         * copy on the page... generate 15-20 alternatives, judge them
         * against ReplyFlow's design principles, choose the strongest."
         * Full shortlist and reasoning captured in the commit/PR notes
         * for this pass. The winner keeps the existing sentence's own
         * cadence and its one emphasised word ("actually"), rather than
         * discarding what already worked, but replaces "knows your
         * business" — increasingly the phone's own job to prove, not
         * the subhead's job to assert — with a claim the subhead alone
         * can carry: that the reply is one you'd genuinely stand
         * behind. "You'd actually send" folds in trust (you'd put your
         * name to it), understanding (it has to know your business to
         * earn that), reliability (it's true of every reply, not just
         * this one) and autonomy (the unstated tension that it was
         * sent without you) into one short, ownable line — never
         * generic SaaS phrasing like "AI-powered" or "automate your
         * replies," which describe the mechanism instead of the
         * outcome. */}
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
         * wants to act?" Reviewed and left exactly where it is.
         * Reasoning: it already sits at the *first* natural decision
         * point (right after the headline/subhead have made the
         * promise), which is what actually matters for an audience
         * this memory already establishes as mobile-first and often
         * short on scroll depth — moving it below the phone would
         * trade a real, measurable risk (visitors who never reach a
         * second CTA) for a "see proof first" benefit the phone
         * mostly already delivers anyway, since on both mobile and
         * desktop it sits only a short scroll below, still inside the
         * same first impression. This matches the standard high-
         * converting shape (Linear, Stripe, Apple product pages all
         * keep a primary CTA in the hero, with supporting proof
         * below) rather than being a default nobody reconsidered. */}
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

          {/* V10 founder review (2026-08-04): "correct but emotionally
           * flat... each point should feel like its own reassurance."
           * Each point now lands on its own short beat instead of all
           * three appearing as one flat block, and the checkmark sits
           * in a small filled circle rather than bare — the same
           * "token, not just an icon" treatment already used for
           * every other badge on this page (`MOMENT_STYLES`,
           * `TONE_CLASSES`), so these read as three small, deliberate
           * confirmations landing in sequence, not one line of small
           * print with checkmarks stuck on the front. */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
            {TRIAL_POINTS.map((point, i) => (
              <motion.span
                key={point}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE, delay: 0.85 + i * 0.1 }}
                className="flex items-center gap-1.5 text-[13.5px] font-medium text-foreground/80"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success/15">
                  <Check className="h-2.5 w-2.5 text-success" strokeWidth={3.5} />
                </span>
                {point}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="relative mx-auto mt-16 max-w-[560px] px-6 pb-20 sm:mt-20 sm:pb-28 lg:mt-24 lg:max-w-[640px] lg:pb-32">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.9 }}
        >
          <AutoConversation story={story} storyIndex={storyIndex} onNext={next} onPrev={prev} onGoTo={goTo} />
        </motion.div>
      </div>
    </section>
  );
}
