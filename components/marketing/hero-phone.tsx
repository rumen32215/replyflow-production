"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
} from "lucide-react";
import { EASE } from "@/components/shared/motion";
import { PhoneFrame, Bubble } from "@/components/shared/phone-preview";
import { TypingDots, useTypedMessage } from "@/components/shared/typed-message";
import { DeviceFrame } from "@/components/marketing/device-frame";
import { cn } from "@/lib/utils";

/**
 * V13 founder review (2026-08-04), verbatim: "This is no longer a UI
 * polish task. This is an experience architecture task... We're no
 * longer designing slides. We're designing one continuous product
 * experience. The phone should feel like one living object." Extracted
 * out of `hero.tsx` (which was already 1080 lines before this pass)
 * specifically because this is now a real second concern — the "living
 * phone" product-demo engine — not a few extra lines inside the
 * marketing-copy component.
 *
 * Four independent, randomly-rotating slides become one three-act
 * journey, always in the same order (this is a story now, not a
 * shuffle): Dashboard (opens instantly, then keeps filling itself in)
 * → Conversation (a rotating pool of five examples, rarely the same
 * one twice) → Photos (a new capability). Manual exploration (drag,
 * dot-click) still jumps anywhere; only the passive auto-advance timer
 * and the in-screen "Watch it work" button move strictly forward,
 * matching "opening an app," not "flipping through screenshots."
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
 * every act below (dashboard, all five conversation-pool examples, the
 * photo act) deliberately uses only these five trades, never a sixth,
 * so the eyebrow's word-highlight mechanism always has something real
 * to point at. */
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

interface ConversationScene extends BaseAct {
  kind: "conversation";
  exchanges: readonly [Exchange, Exchange];
  outcomes: readonly [ProductMoment, ProductMoment];
  mix: GlowMix;
}

interface PhotoAct extends BaseAct {
  kind: "photo";
  customerCaption: string;
  reply: string;
  outcomes: readonly [ProductMoment, ProductMoment];
}

type JourneyAct = DashboardAct | ConversationScene | PhotoAct;

/**
 * The ambient light behind the phone — a founder-named product
 * identity now, not decoration. "Never remove the ambient glow...
 * instead evolve it... it should feel like the phone is radiating
 * intelligence." Four always-mounted colour layers (never all at
 * zero — green anchors every recipe below) instead of one gradient
 * swapped per slide; a scene's mood is a small mix of how much of
 * each layer shows, so two states can genuinely blend (green+blue,
 * green+blue+purple) instead of cutting between flat colours.
 *
 * Colours reuse the exact design tokens already defined in
 * `app/globals.css` rather than inventing a parallel palette:
 * `--success` (green), `--primary` (blue), `--learning` (purple,
 * already commented there as "learning, growth, brain activity" —
 * exactly what "Knowledge" needed), `--attention` (amber, commented
 * "needs awareness, not urgent"). Red is dropped entirely: the
 * existing `urgent` `ProductMoment` styling below already uses
 * `attention` (amber), never `destructive` (red), for its badge and
 * border — the glow following suit isn't a new decision, it's
 * catching up to a colour language the rest of the UI already
 * settled on. Same off-centre focal point (`at 38% 30%`) as every
 * prior pass, matching `device-frame.tsx`'s own physical key-light
 * direction — one coherent light source, still.
 */
type GlowLayer = "green" | "blue" | "purple" | "amber";
type GlowMix = Partial<Record<GlowLayer, number>>;

const GLOW_GRADIENTS: Record<GlowLayer, string> = {
  green: "radial-gradient(ellipse 75% 65% at 38% 30%, rgba(34,197,94,0.34), rgba(34,197,94,0.13) 55%, transparent 78%)",
  blue: "radial-gradient(ellipse 75% 65% at 38% 30%, rgba(37,99,235,0.34), rgba(37,99,235,0.13) 55%, transparent 78%)",
  purple: "radial-gradient(ellipse 75% 65% at 38% 30%, rgba(168,85,247,0.32), rgba(168,85,247,0.12) 55%, transparent 78%)",
  amber: "radial-gradient(ellipse 75% 65% at 38% 30%, rgba(245,158,11,0.36), rgba(245,158,11,0.14) 55%, transparent 78%)",
};

/** Named recipes for every state this pass defines — green never
 * omitted, matching "never disappear." */
const MIX = {
  dashboardCapability: { green: 0.55, blue: 0.8, purple: 0.55 } satisfies GlowMix,
  dashboardKnowledge: { green: 0.5, blue: 0.6, purple: 0.95 } satisfies GlowMix,
  dashboardOutcome: { green: 0.85, blue: 0.35, purple: 0.15 } satisfies GlowMix,
  dashboardUrgent: { green: 0.65, amber: 0.9 } satisfies GlowMix,
  dashboardFinished: { green: 0.9, blue: 0.35 } satisfies GlowMix,
  conversationRoutine: { green: 0.85 } satisfies GlowMix,
  conversationUrgent: { green: 0.6, amber: 0.85 } satisfies GlowMix,
  photoAnalysing: { green: 0.5, blue: 0.85 } satisfies GlowMix,
  photoFinished: { green: 0.9, blue: 0.3 } satisfies GlowMix,
} as const;

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
            opacity: { duration: 0.8, ease: EASE },
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
 * `urgent` uses `attention` (amber), not `destructive` — see the glow
 * doc comment above for why that's the established, not new, choice. */
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

/** Icon + accent per tile `tone` — same lookup-table discipline as
 * `MOMENT_STYLES`. `whatsapp` stays the one literal (non-token)
 * colour on the page — WhatsApp's real green, not the app's internal
 * `success` token — so "WhatsApp connected" reads as an accurate
 * brand fact. */
const TILE_STYLES: Record<AppTile["tone"], { badge: string; icon_: string }> = {
  whatsapp: { badge: "bg-[#25D366]/15", icon_: "text-[#128C4A]" },
  primary: { badge: "bg-primary/15", icon_: "text-primary" },
  success: { badge: "bg-success/15", icon_: "text-success" },
  attention: { badge: "bg-attention/20", icon_: "text-attention" },
  learning: { badge: "bg-learning/15", icon_: "text-learning" },
};

/** Mirrors `preparing-receptionist.tsx`'s own pacing formula. */
function estimateTypeMs(text: string): number {
  return 150 + 520 + Math.min(1500, Math.max(650, text.length * 14));
}

const PRODUCT_MOMENT_DELAY_MS = 900;
const PRODUCT_MOMENT_STEP_MS = 1000;
const CHECKLIST_STEP_MS = 650;
const REST_MS = 6500;

function estimateStoryMs(act: JourneyAct): number {
  if (act.kind === "conversation") {
    return 900 + estimateTypeMs(act.exchanges[0].reply) + 1300 + estimateTypeMs(act.exchanges[1].reply) + PRODUCT_MOMENT_DELAY_MS + PRODUCT_MOMENT_STEP_MS;
  }
  if (act.kind === "photo") {
    return 700 + 1400 + estimateTypeMs(act.reply) + PRODUCT_MOMENT_DELAY_MS + PRODUCT_MOMENT_STEP_MS;
  }
  return 900 + 4 * CHECKLIST_STEP_MS + 500 + 4 * CHECKLIST_STEP_MS + 700 + 1200;
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

/** Five examples, one rotating pool — "the visitor should almost
 * never see the same example twice." Plumber and roofer are the two
 * examples this page has already earned trust with (kept verbatim);
 * the other three are new. Deliberately only the five eyebrow trades
 * (see `Trade` above) — no sixth trade the eyebrow can't highlight. */
const CONVERSATION_POOL: readonly ConversationScene[] = [
  {
    kind: "conversation",
    businessName: "Dean's Plumbing",
    trade: "plumbers",
    mix: MIX.conversationRoutine,
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
    mix: MIX.conversationRoutine,
    exchanges: [
      {
        customer: "Do you do rewires for the whole house, or just partial jobs?",
        reply: "Both — full rewires and partial upgrades. If it's easier, send me a few photos and I'll give you a proper price.",
      },
      {
        customer: "Perfect, I'll send some over.",
        reply: "Sounds good — I'll take a look and come back to you today.",
      },
    ],
    outcomes: [
      { text: "Enquiry logged", kind: "customer" },
      { text: "Quote follow-up scheduled", kind: "scheduled" },
    ],
  },
  {
    kind: "conversation",
    businessName: "Ridgeline Roofing",
    trade: "roofers",
    mix: MIX.conversationUrgent,
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
    mix: MIX.conversationRoutine,
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
    mix: MIX.conversationRoutine,
    exchanges: [
      {
        customer: "Hi, just checking in on the extension quote from last week?",
        reply: "Good timing, I was just finishing it — I'll have it over to you by this evening.",
      },
      {
        customer: "Brilliant, thank you!",
        reply: "No problem — I'll flag it so it doesn't slip through the cracks.",
      },
    ],
    outcomes: [
      { text: "Follow-up handled", kind: "customer" },
      { text: "Quote reprioritised", kind: "job" },
    ],
  },
] as const;

/** New capability, replacing what used to be a second emergency
 * slide. No real customer photo exists to show, and none should be
 * fabricated — `BlurredPhotoBubble` below is a pure-CSS abstraction,
 * honestly illustrative rather than pretending to be a real kitchen.
 * Same business as the roofer example above (continuity — this reads
 * as one more thing that business's receptionist handles, not an
 * unrelated fourth demo). */
const PHOTO_ACT: PhotoAct = {
  kind: "photo",
  businessName: "Ridgeline Roofing",
  trade: "roofers",
  customerCaption: "Here's what it looks like — think a tile's come loose.",
  reply: "Thanks — from the photo it looks like it's just the ridge tile, that's a quick fix. I can get someone out Thursday morning.",
  outcomes: [
    { text: "Booked in for Thursday", kind: "job" },
    { text: "Photo saved to the job", kind: "customer" },
  ],
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

/** The two "inside ReplyFlow" acts (dashboard) get a distinct
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

/** Act 1. Merges what used to be two separate slides (teaching,
 * payoff) into one screen that never resets: four capability tiles
 * reveal, then — without switching screens — four outcome tiles
 * reveal beneath them in the same grid. "The dashboard evolves. Not
 * replaces itself." Once it settles, an in-screen button offers to
 * jump straight into the conversation act; auto-advance eventually
 * does the same if it's never clicked. */
function DashboardView({
  act,
  onMoodChange,
  onWatchItWork,
}: {
  act: DashboardAct;
  onMoodChange: (mix: GlowMix) => void;
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
      onMoodChange(MIX.dashboardCapability);
      await wait(jitter(900, 150));
      for (let i = 0; i < 4; i++) {
        if (i > 0) await wait(jitter(CHECKLIST_STEP_MS, 120));
        setVisibleCount(i + 1);
        if (i === 2) onMoodChange(MIX.dashboardKnowledge);
      }
      await wait(jitter(500, 100));
      onMoodChange(MIX.dashboardOutcome);
      for (let i = 4; i < 8; i++) {
        await wait(jitter(CHECKLIST_STEP_MS, 120));
        setVisibleCount(i + 1);
        if (i === 6) onMoodChange(MIX.dashboardUrgent);
        if (i === 7) onMoodChange(MIX.dashboardFinished);
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
          const { badge, icon_ } = TILE_STYLES[tile.tone];
          const visible = i < visibleCount;
          return (
            <motion.div
              key={tile.text}
              initial={{ opacity: 0, y: 10, scale: 0.94 }}
              animate={visible ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 10, scale: 0.94 }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
              className={cn(
                "flex flex-col items-start gap-2 rounded-xl border p-2.5 shadow-sm",
                isFinal ? "border-primary/25 bg-primary/[0.07]" : "border-border/60 bg-white/85"
              )}
            >
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
          className="mt-4 w-full rounded-xl border border-primary/25 bg-primary/[0.06] py-2.5 text-center text-[12.5px] font-semibold text-primary transition-colors hover:bg-primary/[0.1]"
        >
          Watch it work →
        </motion.button>
      )}
    </ReplyFlowAppShell>
  );
}

/** Act 2. One WhatsApp conversation, fed by whichever `ConversationScene`
 * the rotation pool currently has active — the mechanism itself
 * (typed exchanges, two-step outcome) is unchanged from what already
 * worked well. */
function ConversationSlideView({ scene, onMoodChange }: { scene: ConversationScene; onMoodChange: (mix: GlowMix) => void }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [outcomeCount, setOutcomeCount] = useState(0);
  const startedRef = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    onMoodChange(scene.mix);
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    const jitter = (ms: number, spread: number) => ms + (Math.random() * spread * 2 - spread);

    async function run() {
      await wait(jitter(900, 150));
      for (let i = 0; i < scene.exchanges.length; i++) {
        if (i > 0) await wait(jitter(1300, 250));
        setVisibleCount(i + 1);
        await wait(estimateTypeMs(scene.exchanges[i]!.reply));
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
  }, [visibleCount, outcomeCount]);

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

/** Act 3. Customer sends a (blurred) photo; ReplyFlow reads it,
 * replies naturally, books the job — a capability the page hasn't
 * demonstrated any other way. */
function PhotoActView({ act, onMoodChange }: { act: PhotoAct; onMoodChange: (mix: GlowMix) => void }) {
  const [showPhoto, setShowPhoto] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [outcomeCount, setOutcomeCount] = useState(0);
  const startedRef = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    onMoodChange(MIX.photoAnalysing);
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    const jitter = (ms: number, spread: number) => ms + (Math.random() * spread * 2 - spread);

    async function run() {
      await wait(jitter(700, 150));
      setShowPhoto(true);
      await wait(jitter(1400, 200));
      setShowReply(true);
      await wait(estimateTypeMs(act.reply));
      await wait(jitter(PRODUCT_MOMENT_DELAY_MS, 150));
      onMoodChange(MIX.photoFinished);
      setOutcomeCount(1);
      await wait(jitter(PRODUCT_MOMENT_STEP_MS, 200));
      setOutcomeCount(2);
    }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [showPhoto, showReply, outcomeCount]);

  return (
    <PhoneFrame
      businessName={act.businessName}
      scrollable
      bodyRef={bodyRef}
      headerInsetTop
      className="h-full w-full rounded-none border-0 shadow-none"
    >
      {showPhoto && <BlurredPhotoBubble caption={act.customerCaption} />}
      {showReply && <TypedReply text={act.reply} />}
      {outcomeCount > 0 && (
        <div className="space-y-1.5 pt-2">
          {act.outcomes.slice(0, outcomeCount).map((moment, i) => (
            <ProductMomentCard key={i} moment={moment} />
          ))}
        </div>
      )}
    </PhoneFrame>
  );
}

function ActView({ act, onMoodChange, onNext }: { act: JourneyAct; onMoodChange: (mix: GlowMix) => void; onNext: () => void }) {
  if (act.kind === "dashboard") return <DashboardView act={act} onMoodChange={onMoodChange} onWatchItWork={onNext} />;
  if (act.kind === "conversation") return <ConversationSlideView scene={act} onMoodChange={onMoodChange} />;
  return <PhotoActView act={act} onMoodChange={onMoodChange} />;
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
 * hook watching that index" would create — the pool only needs to
 * advance at the exact moment the index transitions *into* 1, which
 * this hook can do directly since it already owns that transition.
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
    return PHOTO_ACT;
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
    // Dean's Plumbing), then a real shuffle takes over. Safe to also
    // randomise which example plays *first* here (not just subsequent
    // loops): act index 1 isn't visible until the dashboard's full
    // duration has elapsed, long after this effect has resolved.
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
  glowMix,
  onMoodChange,
  onNext,
  onPrev,
  onGoTo,
}: {
  act: JourneyAct;
  storyIndex: number;
  glowMix: GlowMix;
  onMoodChange: (mix: GlowMix) => void;
  onNext: () => void;
  onPrev: () => void;
  onGoTo: (i: number) => void;
}) {
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
                <ActView act={act} onMoodChange={onMoodChange} onNext={onNext} />
              </motion.div>
            </AnimatePresence>
          </DeviceFrame>
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
  const [glowMix, setGlowMix] = useState<GlowMix>(MIX.dashboardCapability);

  useEffect(() => {
    onActiveTradeChange?.(act.trade);
  }, [act.trade, onActiveTradeChange]);

  return (
    <AutoConversation
      act={act}
      storyIndex={storyIndex}
      glowMix={glowMix}
      onMoodChange={setGlowMix}
      onNext={next}
      onPrev={prev}
      onGoTo={goTo}
    />
  );
}
