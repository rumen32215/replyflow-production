"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import {
  AlertTriangle,
  CalendarCheck,
  UserPlus,
  MessageCircle,
  Sparkles,
  BookOpen,
  FileText,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Bell,
  Check,
} from "lucide-react";
import { EASE } from "@/components/shared/motion";
import { PhoneFrame, Bubble } from "@/components/shared/phone-preview";
import { TypingDots, useTypedMessage } from "@/components/shared/typed-message";
import { DeviceFrame } from "@/components/marketing/device-frame";
import { cn } from "@/lib/utils";

/**
 * V13 founder review (2026-08-04): the phone's four independent slides
 * became one three-act journey. V14 founder review (2026-08-04) —
 * after researching why Linear/Stripe/Apple/Vercel/Arc convert (full
 * writeup shared separately): Apple's own stated discipline is that
 * *content motion* (what's being said) and *graphical motion* (the
 * atmosphere) run on separate clocks. V13's glow was still event-
 * driven — a `MIX` snapshot swapped in on every tile/message — which
 * is exactly a graphical effect wearing content motion's clothes.
 * Rebuilt as one continuous, time-driven blend (`useJourneyGlow`
 * below) instead. Same research also drove: dashboard tiles need
 * pacing (pacing *is* emotion, not just reveal order), a real WhatsApp
 * thread has no separate "photo mode" so conversation and photos
 * merge into one act, and a third act that's "another conversation"
 * repeats proof instead of adding a new, specific one (Linear's own
 * lesson: distinctness, not just correctness).
 *
 * Three acts, always in the same order — Dashboard → Conversation →
 * Trust — answering three different customer questions ("what is
 * this," "how does it talk," "why should I believe it"), never a
 * shuffle. Manual exploration (drag, dot-click) still jumps anywhere;
 * only the passive auto-advance timer and the in-screen "Watch it
 * work" button move strictly forward.
 */

interface Exchange {
  customer: string;
  reply: string;
}

interface ProductMoment {
  text: string;
  kind: "job" | "booking" | "scheduled" | "customer" | "urgent" | "team" | "quote";
}

/** Matches one of the exact five words in `hero.tsx`'s eyebrow line —
 * every act below deliberately uses only these five trades, never a
 * sixth, so the eyebrow's word-highlight mechanism always has
 * something real to point at. */
export type Trade = "plumbers" | "electricians" | "builders" | "roofers" | "painters";

interface AppTile {
  icon: typeof AlertTriangle;
  text: string;
  tone: "whatsapp" | "primary" | "success" | "attention" | "learning";
}

interface BaseAct {
  businessName: string;
  trade: Trade;
}

interface DashboardAct extends BaseAct {
  kind: "dashboard";
  capabilityTiles: readonly [AppTile, AppTile, AppTile, AppTile];
  outcomeTiles: readonly [AppTile, AppTile, AppTile, AppTile];
}

/** Founder review (2026-08-04): "a customer doesn't think 'I'm now
 * entering the photo feature' — they simply continue chatting."
 * `photo` is optional and deliberately only present on two of the
 * five pool examples below — real conversations don't always involve
 * a photo either, and making it universal would just trade one
 * repetitive shape for another. When present, it renders as a third
 * beat inside the same thread, after the two exchanges and before the
 * outcomes — never a separate screen. */
interface ConversationScene extends BaseAct {
  kind: "conversation";
  exchanges: readonly [Exchange, Exchange];
  photo?: { customerCaption: string; reply: string };
  outcomes: readonly [ProductMoment, ProductMoment];
}

/** Act 3. Founder review (2026-08-04): "ask yourself — what would make
 * someone trust ReplyFlow even more? We've already proven
 * conversations. Now prove something else." Not a new capability —
 * this project's own existing, already-tested fact-grounding
 * discipline (`lib/reply-engine`'s own test suite: "a payment question
 * that correctly cites the taught fact passes," "never claims a fact
 * was used" unless it genuinely was) made visible for the first time,
 * rather than a new claim. Deliberately plain-language facts a real
 * owner would recognise as their own settings, never mechanism-talk
 * ("checking," "processing," "reasoning") — the goal is "this
 * understands my business," never "this is clever AI." */
interface TrustAct extends BaseAct {
  kind: "trust";
  question: string;
  facts: readonly [string, string, string];
  reply: string;
}

type JourneyAct = DashboardAct | ConversationScene | TrustAct;

/**
 * The ambient light behind the phone — founder-named product identity,
 * not decoration. V14 founder review (2026-08-04): "the glow should
 * become part of ReplyFlow's identity... it must never disappear
 * completely... Blue → Blue+Green → Green → Green+Warm Red → Warm
 * Red... almost impossible to notice. No flashing. No disappearing.
 * No hard cuts." `useJourneyGlow` below samples this exact sequence
 * continuously (see its own doc comment) rather than switching
 * between named snapshots the way V13 did.
 *
 * Three layers now, not four — purple (V13's "Knowledge" spike)
 * dropped entirely. Purple was a *reactive* flicker tied to one tile
 * appearing, which is precisely the event-driven pattern this pass
 * removes; the tile itself keeps its own purple icon; the ambient
 * light no longer chases individual tiles. "Warm Red" reuses the
 * existing `--attention` amber token, not `--destructive` — already
 * established elsewhere in this file as "needs awareness, not
 * urgent," and the founder was explicit: "never aggressive, never
 * danger." Same off-centre focal point (`at 38% 30%`) as every prior
 * pass, matching `device-frame.tsx`'s own physical key-light
 * direction.
 */
type GlowLayer = "blue" | "green" | "amber";
type GlowMix = Partial<Record<GlowLayer, number>>;

const GLOW_GRADIENTS: Record<GlowLayer, string> = {
  green: "radial-gradient(ellipse 75% 65% at 38% 30%, rgba(34,197,94,0.34), rgba(34,197,94,0.13) 55%, transparent 78%)",
  blue: "radial-gradient(ellipse 75% 65% at 38% 30%, rgba(37,99,235,0.34), rgba(37,99,235,0.13) 55%, transparent 78%)",
  amber: "radial-gradient(ellipse 75% 65% at 38% 30%, rgba(245,158,11,0.36), rgba(245,158,11,0.14) 55%, transparent 78%)",
};

/** Shortest distance between two points on a circle of the given
 * period — what makes the arc loop seamlessly (amber fading back into
 * blue as the journey restarts) instead of snapping. */
function circularDistance(a: number, b: number, period: number): number {
  const d = Math.abs(a - b) % period;
  return Math.min(d, period - d);
}

/** A smooth (cosine) falloff from 1 at `center` to 0 at `width` away —
 * three of these, one per colour, overlapping just enough that
 * adjacent acts blend rather than cut (see `useJourneyGlow`). */
function windowWeight(t: number, center: number, width: number, period: number): number {
  const d = circularDistance(t, center, period);
  if (d >= width) return 0;
  return (Math.cos((d / width) * Math.PI) + 1) / 2;
}

const GLOW_WINDOW_WIDTH = 1.4;

/** `globalT` runs 0→3, one unit per act, wrapping — blue peaks mid-
 * Dashboard (0.5), green mid-Conversation (1.5), amber mid-Trust
 * (2.5). At every act boundary the two neighbouring windows overlap
 * (~0.7 combined weight each), which *is* "Blue+Green" / "Green+Warm
 * Red" — not a separate state, just where this continuous curve
 * happens to sit. */
function computeGlowMix(globalT: number): GlowMix {
  return {
    blue: windowWeight(globalT, 0.5, GLOW_WINDOW_WIDTH, 3),
    green: windowWeight(globalT, 1.5, GLOW_WINDOW_WIDTH, 3),
    amber: windowWeight(globalT, 2.5, GLOW_WINDOW_WIDTH, 3),
  };
}

/** Ticks every 200ms while mounted, computing how far through the
 * *current* act we are from real elapsed time (reusing `estimateStoryMs`
 * — no second timing source to keep in sync with the auto-advance
 * clock). `useJourneyGlow` never depends on what's happening *inside*
 * an act (which tile, which exchange) — only on `storyIndex` and time,
 * exactly the "separate clock" Apple's own product pages run on. */
function useJourneyGlow(storyIndex: number, actDurationMs: number): GlowMix {
  const [, forceTick] = useState(0);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
  }, [storyIndex]);

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 200);
    return () => clearInterval(id);
  }, []);

  const elapsed = Date.now() - startRef.current;
  const localProgress = Math.min(1, Math.max(0, elapsed / Math.max(1, actDurationMs)));
  const globalT = storyIndex + localProgress;
  return computeGlowMix(globalT);
}

function PhoneGlow({ mix }: { mix: GlowMix }) {
  return (
    <div
      className="pointer-events-none absolute -inset-x-20 -top-16 -bottom-32 -z-10 rounded-full blur-[70px] sm:-inset-x-28 sm:-top-20 sm:-bottom-40 sm:blur-[90px] lg:-inset-x-36 lg:-top-24 lg:-bottom-48 lg:blur-[110px]"
      aria-hidden
    >
      {(Object.keys(GLOW_GRADIENTS) as GlowLayer[]).map((layer) => (
        <motion.div
          key={layer}
          className="absolute inset-0 rounded-full"
          animate={{ opacity: mix[layer] ?? 0, scale: [1, 1.05, 1] }}
          transition={{
            opacity: { duration: 1, ease: "linear" },
            scale: { duration: 4.2, repeat: Infinity, ease: "easeInOut" },
          }}
          style={{ background: GLOW_GRADIENTS[layer] }}
        />
      ))}
    </div>
  );
}

/** Icon + accent per moment `kind` — real hierarchy (Linear/Stripe/
 * Apple notification language), never one repeated green box.
 * `urgent` uses `attention` (amber), not `destructive`. */
const MOMENT_STYLES: Record<ProductMoment["kind"], { icon: typeof ClipboardCheck; badge: string; icon_: string }> = {
  job: { icon: ClipboardCheck, badge: "bg-success/15", icon_: "text-success" },
  booking: { icon: CalendarCheck, badge: "bg-primary/15", icon_: "text-primary" },
  scheduled: { icon: Clock, badge: "bg-learning/15", icon_: "text-learning" },
  customer: { icon: UserPlus, badge: "bg-success/15", icon_: "text-success" },
  urgent: { icon: AlertTriangle, badge: "bg-attention/20", icon_: "text-attention" },
  team: { icon: Bell, badge: "bg-primary/15", icon_: "text-primary" },
  quote: { icon: FileText, badge: "bg-learning/15", icon_: "text-learning" },
};

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

/** Icon + accent per tile `tone`. `whatsapp` stays the one literal
 * (non-token) colour on the page — WhatsApp's real green. */
const TILE_STYLES: Record<AppTile["tone"], { badge: string; icon_: string; glow: string }> = {
  whatsapp: { badge: "bg-[#25D366]/15", icon_: "text-[#128C4A]", glow: "bg-[#25D366]/50" },
  primary: { badge: "bg-primary/15", icon_: "text-primary", glow: "bg-primary/50" },
  success: { badge: "bg-success/15", icon_: "text-success", glow: "bg-success/50" },
  attention: { badge: "bg-attention/20", icon_: "text-attention", glow: "bg-attention/50" },
  learning: { badge: "bg-learning/15", icon_: "text-learning", glow: "bg-learning/50" },
};

/** Mirrors `preparing-receptionist.tsx`'s own pacing formula. */
function estimateTypeMs(text: string): number {
  return 150 + 520 + Math.min(1500, Math.max(650, text.length * 14));
}

const PRODUCT_MOMENT_DELAY_MS = 900;
const PRODUCT_MOMENT_STEP_MS = 1000;
const CHECKLIST_STEP_MS = 650;
/** Founder review (2026-08-04): "after the fourth tile, the remaining
 * tiles should begin appearing slightly faster — the user already
 * understands what's happening." */
const OUTCOME_STEP_MS = 470;
const REST_MS = 6500;

function estimateStoryMs(act: JourneyAct): number {
  if (act.kind === "conversation") {
    const photoMs = act.photo ? 700 + 1200 + estimateTypeMs(act.photo.reply) : 0;
    return 900 + estimateTypeMs(act.exchanges[0].reply) + 1300 + estimateTypeMs(act.exchanges[1].reply) + photoMs + PRODUCT_MOMENT_DELAY_MS + PRODUCT_MOMENT_STEP_MS;
  }
  if (act.kind === "trust") {
    return 700 + act.facts.length * 550 + 600 + 900 + 1700 + 1200;
  }
  return 900 + 4 * CHECKLIST_STEP_MS + 500 + 4 * OUTCOME_STEP_MS + 900 + 1200;
}

// ---------------------------------------------------------------------------
// Journey data
// ---------------------------------------------------------------------------

const DASHBOARD_ACT: DashboardAct = {
  kind: "dashboard",
  businessName: "Whitmore Building Co",
  trade: "builders",
  capabilityTiles: [
    { icon: MessageCircle, text: "WhatsApp connected", tone: "whatsapp" },
    { icon: Sparkles, text: "Receptionist online", tone: "primary" },
    { icon: BookOpen, text: "Knowledge learned", tone: "learning" },
    { icon: FileText, text: "Quotes ready", tone: "primary" },
  ],
  outcomeTiles: [
    { icon: CalendarCheck, text: "Appointments booked", tone: "success" },
    { icon: UserPlus, text: "Customers updated", tone: "success" },
    { icon: AlertTriangle, text: "Urgent, prioritised", tone: "attention" },
    { icon: CheckCircle2, text: "Nothing waiting for you", tone: "primary" },
  ],
};

/** Five examples, one rotating pool. Two (electrician, builder) grow a
 * natural third beat where the customer sends a photo mid-thread —
 * see `ConversationScene.photo`'s own doc comment for why only two,
 * not all five. */
const CONVERSATION_POOL: readonly ConversationScene[] = [
  {
    kind: "conversation",
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
    outcomes: [
      { text: "Booked in for 4pm today", kind: "job" },
      { text: "Confirmation sent to the customer", kind: "customer" },
    ],
  },
  {
    kind: "conversation",
    businessName: "Harris Electrical",
    trade: "electricians",
    exchanges: [
      {
        customer: "Do you do rewires for the whole house, or just partial jobs?",
        reply: "Both — full rewires and partial upgrades. If it's easier, send me a few photos and I'll give you a proper price.",
      },
      {
        customer: "Perfect, I'll send some over.",
        reply: "Sounds good — send them over whenever's easy.",
      },
    ],
    photo: {
      customerCaption: "Here's the fusebox and the upstairs sockets.",
      reply: "Thanks — that's really helpful, I can see exactly what needs doing. I'll get you a proper price by this evening.",
    },
    outcomes: [
      { text: "Quote based on the photos", kind: "quote" },
      { text: "Sent by this evening", kind: "scheduled" },
    ],
  },
  {
    kind: "conversation",
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
    outcomes: [
      { text: "Flagged as urgent — team alerted", kind: "urgent" },
      { text: "Someone's on the way to sort it", kind: "team" },
    ],
  },
  {
    kind: "conversation",
    businessName: "Bright Coat Painters",
    trade: "painters",
    exchanges: [
      {
        customer: "How much would it be to repaint a 3-bed semi, inside only?",
        reply: "For a 3-bed inside you're typically looking at £1,800–£2,400 depending on finish — I can get you an exact quote if you tell me the rooms.",
      },
      {
        customer: "Just the bedrooms and hallway for now.",
        reply: "That narrows it down nicely — I'll get a proper quote over to you today.",
      },
    ],
    outcomes: [
      { text: "Quote sent", kind: "quote" },
      { text: "Follow-up booked in", kind: "scheduled" },
    ],
  },
  {
    kind: "conversation",
    businessName: "Marsh & Co Builders",
    trade: "builders",
    exchanges: [
      {
        customer: "Hi, just checking in on the extension quote from last week?",
        reply: "Good timing, I was just finishing it — quick one, could you send a photo of the boundary wall? Wasn't sure from the measurements.",
      },
      {
        customer: "Sure, one sec.",
        reply: "Perfect, take your time.",
      },
    ],
    photo: {
      customerCaption: "Here you go — that's the wall in question.",
      reply: "Got it, that confirms it — I'll have the full quote over to you by this evening.",
    },
    outcomes: [
      { text: "Quote confirmed from photo", kind: "quote" },
      { text: "Sent by this evening", kind: "scheduled" },
    ],
  },
] as const;

/** Act 3. Same business as the Dashboard act — bookends the journey
 * as one business's whole system, not a fourth unrelated demo. Plain,
 * concrete facts an owner would recognise as their own settings —
 * "understands my business," never "clever AI." */
const TRUST_ACT: TrustAct = {
  kind: "trust",
  businessName: "Whitmore Building Co",
  trade: "builders",
  question: "Do you charge extra for evening call-outs?",
  facts: ["Evening call-out fee: £25 after 6pm", "Weekend jobs: yes, by arrangement", "Standard response time: same day"],
  reply: "Yeah, evenings are fine — it's a flat £25 call-out after 6pm, same as any other job.",
};

export const HERO_PHONE_INITIAL_TRADE: Trade = DASHBOARD_ACT.trade;

const BATTERY_BY_STORY: readonly number[] = [97, 92, 88] as const;

// ---------------------------------------------------------------------------
// Act views
// ---------------------------------------------------------------------------

function TypedReply({ text }: { text: string }) {
  const { display, isThinking, isBusy } = useTypedMessage(text);
  return (
    <Bubble from="receptionist" className="min-h-[34px] lg:text-[14px]" animateTicks={!isBusy}>
      {isThinking || display.length === 0 ? <TypingDots className="px-1 py-1" /> : <span>{display}</span>}
    </Bubble>
  );
}

/** The "inside ReplyFlow" acts (Dashboard, Trust) get a distinct
 * ReplyFlow-branded header in place of WhatsApp's — the visitor
 * consciously registers "this is a different screen" before reading a
 * word. Deliberately local to this file rather than changing
 * `PhoneFrame`: that component's WhatsApp header is real, load-bearing
 * UI elsewhere in the product. */
function ReplyFlowAppShell({
  subtitle,
  bodyRef,
  children,
}: {
  subtitle: string;
  bodyRef?: React.RefObject<HTMLDivElement>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#f4f2ef]">
      <div className="flex shrink-0 items-center gap-3 bg-gradient-to-r from-primary to-success px-4 pb-3 pt-[42px] text-white">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
            <path d="M4 20l1.6-4.8A8 8 0 1112 20a7.96 7.96 0 01-3.9-1L4 20z" fill="white" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold leading-tight">ReplyFlow</p>
          <p className="truncate text-[11px] leading-tight text-white/80">{subtitle}</p>
        </div>
      </div>
      <div
        ref={bodyRef}
        className="flex-1 overflow-y-auto px-3 py-4"
        style={{ backgroundImage: "radial-gradient(circle at 20% 10%, rgba(255,255,255,0.4), transparent 40%)" }}
      >
        {children}
      </div>
    </div>
  );
}

/** Act 1. Founder review (2026-08-04): "when each tile appears it
 * should feel like ReplyFlow has just completed another job... very
 * tiny scale, very soft glow, tiny bounce, tiny pulse, then settle
 * forever." Each tile gets its own brief local bloom (`TILE_STYLES`'s
 * `glow`) as it settles, independent of the ambient phone glow — a
 * small "job done" acknowledgement, not the same thing as the
 * environment. Pace shortens once the outcome tiles start
 * (`OUTCOME_STEP_MS` < `CHECKLIST_STEP_MS`) — "the user already
 * understands what's happening, speed should increase." The final
 * tile triggers `onCelebrate` — a one-shot acknowledgement on the
 * phone itself, not the tile — before the button appears. */
function DashboardView({
  act,
  onCelebrate,
  onWatchItWork,
}: {
  act: DashboardAct;
  onCelebrate: () => void;
  onWatchItWork: () => void;
}) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showButton, setShowButton] = useState(false);
  const startedRef = useRef(false);
  const allTiles = useMemo(() => [...act.capabilityTiles, ...act.outcomeTiles], [act]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    const jitter = (ms: number, spread: number) => ms + (Math.random() * spread * 2 - spread);

    async function run() {
      await wait(jitter(900, 150));
      for (let i = 0; i < 4; i++) {
        if (i > 0) await wait(jitter(CHECKLIST_STEP_MS, 120));
        setVisibleCount(i + 1);
      }
      await wait(jitter(500, 100));
      for (let i = 4; i < 8; i++) {
        await wait(jitter(OUTCOME_STEP_MS, 80));
        setVisibleCount(i + 1);
        if (i === 7) onCelebrate();
      }
      await wait(jitter(700, 150));
      setShowButton(true);
    }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ReplyFlowAppShell subtitle="What I quietly do">
      <div className="grid grid-cols-2 gap-2">
        {allTiles.map((tile, i) => {
          const isFinal = i === allTiles.length - 1;
          const { badge, icon_, glow } = TILE_STYLES[tile.tone];
          const visible = i < visibleCount;
          return (
            <motion.div
              key={tile.text}
              className={cn(
                "relative flex flex-col items-start gap-2 rounded-xl border p-2 shadow-sm sm:p-2.5",
                isFinal ? "border-primary/25 bg-primary/[0.07]" : "border-border/60 bg-white/85"
              )}
              initial={{ opacity: 0, y: 10, scale: 0.92 }}
              animate={
                visible
                  ? { opacity: 1, y: 0, scale: 1 }
                  : { opacity: 0, y: 10, scale: 0.92 }
              }
              transition={{ type: "spring", stiffness: 380, damping: 18 }}
            >
              {/* The tile's own brief "job done" bloom — settles and
               * fades within ~600ms, never lingers, never repeats. */}
              {visible && (
                <motion.span
                  aria-hidden
                  className={cn("pointer-events-none absolute -inset-1.5 -z-10 rounded-2xl blur-md", glow)}
                  initial={{ opacity: 0.55, scale: 0.85 }}
                  animate={{ opacity: 0, scale: 1.15 }}
                  transition={{ duration: 0.6, ease: EASE }}
                />
              )}
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", badge)}>
                <tile.icon className={cn("h-3.5 w-3.5", icon_)} strokeWidth={2.5} />
              </span>
              <span className={cn("text-[11.5px] font-semibold leading-tight lg:text-[12.5px]", isFinal ? "text-primary" : "text-foreground")}>
                {tile.text}
              </span>
            </motion.div>
          );
        })}
      </div>
      {showButton && (
        <motion.button
          type="button"
          onClick={onWatchItWork}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="mt-6 w-full rounded-xl border border-primary/25 bg-primary/[0.06] py-2.5 text-center text-[12.5px] font-semibold text-primary transition-colors hover:bg-primary/[0.1] sm:mt-4"
        >
          Watch it work →
        </motion.button>
      )}
    </ReplyFlowAppShell>
  );
}

/** Deliberately blurred — not a quality flaw, a privacy choice. No
 * real customer photo exists, and none should be fabricated; this is
 * a pure-CSS abstraction that's honest about being illustrative. */
function BlurredPhotoBubble({ caption }: { caption: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[72%] overflow-hidden rounded-2xl rounded-bl-md border border-black/5 shadow-sm">
        <div
          className="relative h-28 w-full overflow-hidden"
          style={{ background: "linear-gradient(135deg, #b7c6d9 0%, #8fa3ba 45%, #a9b8c9 100%)" }}
        >
          <div className="absolute -left-4 -top-6 h-20 w-20 rounded-full bg-white/25 blur-xl" aria-hidden />
          <div className="absolute -bottom-8 -right-2 h-24 w-24 rounded-full bg-black/10 blur-2xl" aria-hidden />
          <div className="absolute inset-0 backdrop-blur-md" aria-hidden />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-white/80" aria-hidden>
              <path
                d="M4 8a2 2 0 012-2h1.2l.9-1.5A1 1 0 019 4h6a1 1 0 01.9.5L16.8 6H18a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V8z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </div>
        </div>
        <div className="bg-white px-3 py-2 text-[12px] leading-relaxed text-foreground">{caption}</div>
        <div className="bg-white px-3 pb-1.5 text-[10px] text-muted-foreground/60">Customer photo — blurred for privacy</div>
      </div>
    </div>
  );
}

/** Act 2. One WhatsApp conversation, fed by whichever `ConversationScene`
 * the rotation pool currently has active. When the scene has a
 * `photo`, it plays as a third beat inside the same thread — the
 * customer simply keeps talking, they never "switch features." */
function ConversationSlideView({ scene }: { scene: ConversationScene }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showPhoto, setShowPhoto] = useState(false);
  const [showPhotoReply, setShowPhotoReply] = useState(false);
  const [outcomeCount, setOutcomeCount] = useState(0);
  const startedRef = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    const jitter = (ms: number, spread: number) => ms + (Math.random() * spread * 2 - spread);

    async function run() {
      await wait(jitter(900, 150));
      for (let i = 0; i < scene.exchanges.length; i++) {
        if (i > 0) await wait(jitter(1300, 250));
        setVisibleCount(i + 1);
        await wait(estimateTypeMs(scene.exchanges[i]!.reply));
      }
      if (scene.photo) {
        await wait(jitter(900, 150));
        setShowPhoto(true);
        await wait(jitter(1200, 200));
        setShowPhotoReply(true);
        await wait(estimateTypeMs(scene.photo.reply));
      }
      await wait(jitter(PRODUCT_MOMENT_DELAY_MS, 150));
      setOutcomeCount(1);
      await wait(jitter(PRODUCT_MOMENT_STEP_MS, 200));
      setOutcomeCount(2);
    }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleCount, showPhoto, showPhotoReply, outcomeCount]);

  return (
    <PhoneFrame
      businessName={scene.businessName}
      scrollable
      bodyRef={bodyRef}
      headerInsetTop
      className="h-full w-full rounded-none border-0 shadow-none"
    >
      {scene.exchanges.slice(0, visibleCount).map((exchange, i) => (
        <div key={i}>
          <Bubble from="customer" className="lg:text-[14px]">{exchange.customer}</Bubble>
          <TypedReply text={exchange.reply} />
        </div>
      ))}
      {showPhoto && scene.photo && <BlurredPhotoBubble caption={scene.photo.customerCaption} />}
      {showPhotoReply && scene.photo && <TypedReply text={scene.photo.reply} />}
      {outcomeCount > 0 && (
        <div className="space-y-1.5 pt-2">
          {scene.outcomes.slice(0, outcomeCount).map((moment, i) => (
            <ProductMomentCard key={i} moment={moment} />
          ))}
        </div>
      )}
    </PhoneFrame>
  );
}

/** Act 3 — "Grounded, not guessed." A third visual grammar (after the
 * tile grid and chat bubbles): a customer question, the plain business
 * facts it's already been taught settling one at a time, then a reply
 * that visibly stands on top of them. No mechanism-talk in the copy —
 * "checking," "processing," "reasoning" would read as "clever AI";
 * this reads as "this understands my business" instead. */
function TrustActView({ act }: { act: TrustAct }) {
  const [showQuestion, setShowQuestion] = useState(false);
  const [factCount, setFactCount] = useState(0);
  const [showThinking, setShowThinking] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const startedRef = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    const jitter = (ms: number, spread: number) => ms + (Math.random() * spread * 2 - spread);

    async function run() {
      await wait(jitter(500, 100));
      setShowQuestion(true);
      await wait(jitter(700, 120));
      for (let i = 0; i < act.facts.length; i++) {
        if (i > 0) await wait(jitter(550, 100));
        setFactCount(i + 1);
      }
      await wait(jitter(500, 100));
      setShowThinking(true);
      await wait(jitter(900, 150));
      setShowThinking(false);
      setShowReply(true);
    }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [showQuestion, factCount, showThinking, showReply]);

  return (
    <ReplyFlowAppShell subtitle="Why you can trust what it says" bodyRef={bodyRef}>
      {showQuestion && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="rounded-xl border border-border/60 bg-white/85 px-3 py-2.5 text-[12px] leading-relaxed text-foreground/80 shadow-sm"
        >
          <span className="font-semibold text-foreground">Customer asked: </span>
          &ldquo;{act.question}&rdquo;
        </motion.div>
      )}

      {factCount > 0 && (
        <div className="mt-2.5 space-y-1.5">
          {act.facts.slice(0, factCount).map((fact, i) => (
            <motion.div
              key={fact}
              initial={{ opacity: 0, x: -6, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 360, damping: 22, delay: i === factCount - 1 ? 0 : 0 }}
              className="flex items-center gap-2 rounded-lg border border-learning/20 bg-learning/[0.06] px-2.5 py-1.5 text-[11.5px] font-medium text-foreground/80"
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-learning/20">
                <Check className="h-2.5 w-2.5 text-learning" strokeWidth={3} />
              </span>
              {fact}
            </motion.div>
          ))}
        </div>
      )}

      {showThinking && (
        <div className="mt-2.5 flex justify-start">
          <div className="rounded-2xl rounded-bl-md bg-white px-3.5 py-2 shadow-sm">
            <TypingDots className="px-1 py-1" />
          </div>
        </div>
      )}

      {showReply && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="mt-2.5 rounded-xl border border-primary/25 bg-primary/[0.06] px-3 py-2.5 text-[12.5px] font-medium leading-relaxed text-foreground shadow-sm"
        >
          {act.reply}
        </motion.div>
      )}

      {showReply && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.3 }}
          className="mt-3 text-center text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground/60"
        >
          Grounded in what&apos;s actually been taught — never guessed.
        </motion.p>
      )}
    </ReplyFlowAppShell>
  );
}

function ActView({ act, onNext, onCelebrate }: { act: JourneyAct; onNext: () => void; onCelebrate: () => void }) {
  if (act.kind === "dashboard") return <DashboardView act={act} onCelebrate={onCelebrate} onWatchItWork={onNext} />;
  if (act.kind === "conversation") return <ConversationSlideView scene={act} />;
  return <TrustActView act={act} />;
}

function StoryDots({ active, count, onSelect }: { active: number; count: number; onSelect: (i: number) => void }) {
  return (
    <div className="mt-4 flex items-center justify-center gap-2" role="tablist" aria-label="Choose what to watch">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === active}
          aria-label={`Show step ${i + 1}`}
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

// ---------------------------------------------------------------------------
// Journey controller
// ---------------------------------------------------------------------------

/**
 * Owns the three-act index, the conversation-pool rotation, and the
 * auto-advance clock. `journeyAt`/`sceneRef` (a ref, read
 * synchronously inside `setTimeout`/`goTo`) avoid a circular
 * dependency that a naive split into "an index hook" + "a rotation
 * hook watching that index" would create.
 */
function useHeroJourney() {
  const [storyIndex, setStoryIndex] = useState(0);
  const [conversationScene, setConversationScene] = useState<ConversationScene>(CONVERSATION_POOL[0]!);
  const indexRef = useRef(0);
  const sceneRef = useRef<ConversationScene>(CONVERSATION_POOL[0]!);
  const poolOrderRef = useRef<number[]>([0, 1, 2, 3, 4]);
  const poolPtrRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const journeyAt = useCallback((i: number): JourneyAct => {
    if (i === 0) return DASHBOARD_ACT;
    if (i === 1) return sceneRef.current;
    return TRUST_ACT;
  }, []);

  const maybeAdvanceConversation = useCallback((newIndex: number, oldIndex: number) => {
    if (newIndex === 1 && oldIndex !== 1) {
      poolPtrRef.current = (poolPtrRef.current + 1) % poolOrderRef.current.length;
      const nextScene = CONVERSATION_POOL[poolOrderRef.current[poolPtrRef.current]!]!;
      sceneRef.current = nextScene;
      setConversationScene(nextScene);
    }
  }, []);

  const scheduleNext = useCallback(
    (fromIndex: number) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        const upcoming = (indexRef.current + 1) % 3;
        maybeAdvanceConversation(upcoming, indexRef.current);
        indexRef.current = upcoming;
        setStoryIndex(upcoming);
        scheduleNext(upcoming);
      }, estimateStoryMs(journeyAt(fromIndex)) + REST_MS);
    },
    [journeyAt, maybeAdvanceConversation]
  );

  useEffect(() => {
    // Shuffle the pool order client-side only — deterministic on the
    // server and the first client paint (always `CONVERSATION_POOL[0]`,
    // Dean's Plumbing), then a real shuffle takes over.
    const arr = [0, 1, 2, 3, 4];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    poolOrderRef.current = arr;
    poolPtrRef.current = 0;
    sceneRef.current = CONVERSATION_POOL[arr[0]!]!;
    setConversationScene(sceneRef.current);

    indexRef.current = 0;
    setStoryIndex(0);
    scheduleNext(0);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = useCallback(
    (i: number) => {
      const clamped = ((i % 3) + 3) % 3;
      maybeAdvanceConversation(clamped, indexRef.current);
      indexRef.current = clamped;
      setStoryIndex(clamped);
      scheduleNext(clamped);
    },
    [scheduleNext, maybeAdvanceConversation]
  );
  const next = useCallback(() => goTo(indexRef.current + 1), [goTo]);
  const prev = useCallback(() => goTo(indexRef.current - 1), [goTo]);

  return { storyIndex, act: journeyAt(storyIndex), conversationScene, goTo, next, prev };
}

function AutoConversation({
  act,
  storyIndex,
  onNext,
  onPrev,
  onGoTo,
}: {
  act: JourneyAct;
  storyIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onGoTo: (i: number) => void;
}) {
  const glowMix = useJourneyGlow(storyIndex, estimateStoryMs(act));

  /** Founder review (2026-08-04): "when the final tile appears, the
   * phone itself should give a tiny celebratory acknowledgement — not
   * a cartoon bounce, something premium. A tiny vibration. Tiny lift.
   * Tiny pulse." A separate inner `motion.div`, purely so this one-
   * shot sequence composes with (rather than fights) the outer float/
   * drag loop below, which never stops. */
  const celebrateControls = useAnimationControls();
  const celebrate = useCallback(() => {
    void celebrateControls.start(
      { scale: [1, 1.025, 1], y: [0, -8, -3, 0], rotate: [0, -1, 0.6, 0] },
      { duration: 0.7, ease: EASE }
    );
  }, [celebrateControls]);

  return (
    <div>
      <div className="relative mx-auto max-w-[340px] lg:max-w-[400px]">
        <PhoneGlow mix={glowMix} />
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
            rotateZ: { duration: 12, repeat: Infinity, ease: "easeInOut", times: [0, 0.65, 0.7, 0.76, 0.82, 1] },
          }}
          style={{ transformPerspective: 1300 }}
          className="cursor-grab touch-pan-y active:cursor-grabbing"
        >
          <motion.div animate={celebrateControls}>
            <DeviceFrame battery={BATTERY_BY_STORY[storyIndex] ?? 90}>
              <AnimatePresence initial={false}>
                <motion.div
                  key={storyIndex}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="absolute inset-0 h-full w-full"
                >
                  <ActView act={act} onNext={onNext} onCelebrate={celebrate} />
                </motion.div>
              </AnimatePresence>
            </DeviceFrame>
          </motion.div>
        </motion.div>
      </div>

      <StoryDots active={storyIndex} count={3} onSelect={onGoTo} />

      <p className="mt-3 text-center text-[12px] text-muted-foreground/70">
        How ReplyFlow works — grounded in what&apos;s actually been taught, never guessed.
        <br />
        Illustrative examples, not real customer data.
      </p>
    </div>
  );
}

export function HeroPhone({ onActiveTradeChange }: { onActiveTradeChange?: (trade: Trade) => void }) {
  const { storyIndex, act, goTo, next, prev } = useHeroJourney();

  useEffect(() => {
    onActiveTradeChange?.(act.trade);
  }, [act.trade, onActiveTradeChange]);

  return <AutoConversation act={act} storyIndex={storyIndex} onNext={next} onPrev={prev} onGoTo={goTo} />;
}
