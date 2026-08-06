"use client";

import { forwardRef, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wrench,
  Zap,
  Paintbrush,
  Hammer,
  Home as HomeIcon,
  MapPin,
  Check,
  MessageCircle,
  FileText,
  CalendarCheck,
  UserPlus,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { EASE } from "@/components/shared/motion";
import { ONBOARDING_TRADES, ONBOARDING_TRADE_LABELS } from "@/lib/trades";
import { DAY_KEYS, DAY_LABELS, type DayKey } from "@/lib/availability";
import { createClient } from "@/lib/supabase/client";
import { signupSchema } from "@/lib/validations/auth";
import { useReceptionistReveal } from "@/components/shared/receptionist-reveal";
import { cn } from "@/lib/utils";

/**
 * V8 architectural reset — the receptionist creation experience,
 * rebuilt entirely from the receptionist's point of view rather than
 * a form's. Mounted by `PeaceOfMind` once the illustrative demo has
 * been absorbed. Every tile here is invented per-moment (not a text
 * input dropped into a shared card shape) — see the design discussion
 * this was built from for why each one works the way it does.
 *
 * Five real facts, five separate tiles, never combined: Business
 * Name, Trade, Coverage, Hours, Knowledge. A sixth, "Receptionist
 * Online," is not a business fact — it's the moment the receptionist
 * is actually allowed to work, and performs the real account
 * creation. Five more tiles (WhatsApp, Quotes, Appointments,
 * Customers, Urgent Jobs) stay honestly dormant the whole time —
 * they represent real work that hasn't happened yet, never faked.
 */

type Trade = (typeof ONBOARDING_TRADES)[number];
type StepId = "identity" | "trade" | "coverage" | "hours" | "knowledge" | "activation";
const SEQUENCE: StepId[] = ["identity", "trade", "coverage", "hours", "knowledge", "activation"];

const TRADE_ICONS: Record<Trade, LucideIcon> = {
  plumbing: Wrench,
  electrical: Zap,
  painting: Paintbrush,
  building: Hammer,
  roofing: HomeIcon,
};

interface Values {
  businessName: string;
  trade: Trade | null;
  areas: string[];
  opening: string;
  closing: string;
  memory: string;
}

const WAITING_ITEMS: readonly { icon: LucideIcon; text: string }[] = [
  { icon: MessageCircle, text: "WhatsApp connected" },
  { icon: FileText, text: "Quotes ready" },
  { icon: CalendarCheck, text: "Appointments booked" },
  { icon: UserPlus, text: "Customers updated" },
  { icon: AlertTriangle, text: "Urgent jobs prioritised" },
];

function formatTime12h(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return mStr === "00" ? `${h12}${period}` : `${h12}:${mStr}${period}`;
}

function clockAngle(t: string): number {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);
  return (((h % 12) + m / 60) / 12) * 360;
}

/** Shared chrome for every settled (already-born) tile in the growing
 * zone — the compact "fact" state each interaction collapses into
 * once answered. */
const SettledTile = forwardRef<HTMLDivElement, { label: string; children: React.ReactNode; big?: boolean }>(
  function SettledTile({ label, children, big }, ref) {
    return (
      <motion.div
        ref={ref}
        layout
        initial={{ opacity: 0, scale: 0.9, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className={cn(
          "rounded-2xl border border-success/25 bg-success/[0.04] p-4",
          big ? "col-span-2 sm:col-span-1" : ""
        )}
      >
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-success/80">{label}</p>
        <div className="mt-1.5">{children}</div>
      </motion.div>
    );
  }
);

/** The tile currently being born — visually distinct from settled
 * tiles (soft glow, slightly larger) so it's obvious this is where
 * attention is right now. */
const OpenTile = forwardRef<HTMLDivElement, { children: React.ReactNode }>(function OpenTile({ children }, ref) {
  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="col-span-2 rounded-2xl border-2 border-primary/25 bg-card p-5 shadow-[0_0_0_5px_rgba(37,99,235,0.05)] sm:col-span-3"
    >
      {children}
    </motion.div>
  );
});

/* ---------------------------- Identity ---------------------------- */

function IdentityOpen({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState("");
  const [focused, setFocused] = useState(false);

  return (
    <div className="text-center">
      <p className="mb-4 text-[13px] font-semibold text-muted-foreground">What should I call your business?</p>
      <motion.div layout className={cn("mx-auto", focused || name ? "w-full" : "w-40")} transition={{ type: "spring", stiffness: 260, damping: 28 }}>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => e.key === "Enter" && name.trim().length >= 2 && onDone(name.trim())}
          placeholder="Type it here"
          maxLength={80}
          aria-label="Business name"
          className="h-14 w-full rounded-2xl border-2 border-border bg-background px-4 text-center text-[19px] font-extrabold tracking-tight outline-none transition-colors duration-300 placeholder:font-normal placeholder:text-muted-foreground/40 focus:border-primary"
        />
      </motion.div>
      <button
        type="button"
        onClick={() => name.trim().length >= 2 && onDone(name.trim())}
        disabled={name.trim().length < 2}
        className="mt-4 rounded-full bg-primary px-5 py-2.5 text-[13.5px] font-semibold text-primary-foreground shadow-sm disabled:opacity-40"
      >
        That&apos;s the one
      </button>
    </div>
  );
}

/* ------------------------------ Trade ------------------------------ */

function TradeOpen({ onDone }: { onDone: (t: Trade) => void }) {
  return (
    <div className="text-center">
      <p className="mb-4 text-[13px] font-semibold text-muted-foreground">What&apos;s your trade?</p>
      <div className="grid grid-cols-5 gap-2">
        {ONBOARDING_TRADES.map((t) => {
          const Icon = TRADE_ICONS[t];
          return (
            <button
              key={t}
              type="button"
              onClick={() => onDone(t)}
              className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-border bg-background p-2.5 transition-colors hover:border-primary/50"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-[9.5px] font-semibold leading-tight">{ONBOARDING_TRADE_LABELS[t]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------- Coverage ----------------------------- */

function CoverageOpen({ onDone }: { onDone: (areas: string[]) => void }) {
  const [text, setText] = useState("");
  const [landed, setLanded] = useState<string[]>([]);

  function submit() {
    const parts = text
      .split(/,| and | & /i)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setLanded(parts);
  }

  return (
    <div className="text-center">
      <p className="mb-4 text-[13px] font-semibold text-muted-foreground">Where do you work?</p>
      {landed.length === 0 ? (
        <>
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Leeds, Bradford, and the villages around them"
            maxLength={200}
            aria-label="Where do you work"
            className="h-14 w-full rounded-2xl border-2 border-border bg-background px-4 text-center text-[15px] font-semibold tracking-tight outline-none transition-colors duration-300 placeholder:font-normal placeholder:text-muted-foreground/40 focus:border-primary"
          />
          <button
            type="button"
            onClick={submit}
            disabled={text.trim().length === 0}
            className="mt-4 rounded-full bg-primary px-5 py-2.5 text-[13.5px] font-semibold text-primary-foreground shadow-sm disabled:opacity-40"
          >
            That&apos;s my patch
          </button>
        </>
      ) : (
        <>
          <div className="flex flex-wrap justify-center gap-2">
            {landed.map((a, i) => (
              <motion.span
                key={a}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 380, damping: 22, delay: i * 0.12 }}
                className="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-primary"
              >
                <MapPin className="h-3 w-3" />
                {a}
              </motion.span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onDone(landed)}
            className="mt-4 rounded-full bg-primary px-5 py-2.5 text-[13.5px] font-semibold text-primary-foreground shadow-sm"
          >
            Confirm coverage
          </button>
        </>
      )}
    </div>
  );
}

/* ------------------------------ Hours ------------------------------ */

const DEFAULT_OPENING = "08:00";
const DEFAULT_CLOSING = "17:30";

function HoursOpen({ trade, onDone }: { trade: Trade | null; onDone: (opening: string, closing: string) => void }) {
  const [adjusting, setAdjusting] = useState(false);
  const [days, setDays] = useState<DayKey[]>(["mon", "tue", "wed", "thu", "fri"]);
  const [opening, setOpening] = useState(DEFAULT_OPENING);
  const [closing, setClosing] = useState(DEFAULT_CLOSING);
  const label = trade ? `${ONBOARDING_TRADE_LABELS[trade].toLowerCase()}s` : "businesses like yours";

  if (adjusting) {
    return (
      <div>
        <p className="mb-3 text-center text-[13px] font-semibold text-muted-foreground">Set your real hours</p>
        <div className="mb-3 grid grid-cols-7 gap-1.5">
          {DAY_KEYS.map((d) => {
            const on = days.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))}
                className={cn(
                  "rounded-lg border-2 py-2 text-[10.5px] font-bold",
                  on ? "border-success bg-success/10 text-success" : "border-border text-muted-foreground"
                )}
              >
                {DAY_LABELS[d].slice(0, 2)}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <input type="time" value={opening} onChange={(e) => setOpening(e.target.value)} className="h-11 flex-1 rounded-xl border-2 border-border bg-background px-3 text-[14px] font-semibold outline-none focus:border-primary" />
          <span className="text-muted-foreground">–</span>
          <input type="time" value={closing} onChange={(e) => setClosing(e.target.value)} className="h-11 flex-1 rounded-xl border-2 border-border bg-background px-3 text-[14px] font-semibold outline-none focus:border-primary" />
        </div>
        <button
          type="button"
          onClick={() => onDone(opening, closing)}
          disabled={days.length === 0 || !(opening < closing)}
          className="mx-auto mt-4 block rounded-full bg-primary px-5 py-2.5 text-[13.5px] font-semibold text-primary-foreground shadow-sm disabled:opacity-40"
        >
          That&apos;s right
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="relative mx-auto mb-3 h-16 w-16">
        <div className="h-16 w-16 rounded-full border-2 border-border" />
        <div
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from ${clockAngle(DEFAULT_OPENING) - 90}deg, rgba(34,197,94,0.28) 0deg, rgba(34,197,94,0.28) ${Math.max(0, clockAngle(DEFAULT_CLOSING) - clockAngle(DEFAULT_OPENING))}deg, transparent 0deg)`,
          }}
        />
        <motion.span
          aria-hidden
          initial={{ rotate: 0 }}
          animate={{ rotate: clockAngle(DEFAULT_CLOSING) }}
          transition={{ duration: 0.9, ease: EASE }}
          className="absolute left-1/2 top-1/2 h-6 w-[2px] origin-bottom -translate-x-1/2 -translate-y-full bg-primary"
        />
      </div>
      <p className="text-[13.5px] font-semibold">
        Most {label} I work with run weekdays, {formatTime12h(DEFAULT_OPENING)} till {formatTime12h(DEFAULT_CLOSING)}.
      </p>
      <p className="mt-1 text-[12px] text-muted-foreground">I&apos;ll start you there.</p>
      <div className="mt-4 flex justify-center gap-2.5">
        <button type="button" onClick={() => onDone(DEFAULT_OPENING, DEFAULT_CLOSING)} className="rounded-full bg-primary px-5 py-2.5 text-[13.5px] font-semibold text-primary-foreground shadow-sm">
          That&apos;s about right
        </button>
        <button type="button" onClick={() => setAdjusting(true)} className="rounded-full border-2 border-border px-4 py-2.5 text-[13px] font-semibold text-muted-foreground">
          Let me adjust it
        </button>
      </div>
    </div>
  );
}

/* ---------------------------- Knowledge ---------------------------- */

const EXAMPLES = ["We always wear shoe covers", "Family business, three generations", "Guaranteed for five years"];

function KnowledgeOpen({ onDone }: { onDone: (memory: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div>
      <p className="mb-1 text-center text-[13px] font-semibold text-muted-foreground">Tell me one thing worth mentioning to a customer.</p>
      <p className="mb-4 text-center text-[11.5px] text-muted-foreground/70">So I can bring it up naturally when it&apos;s relevant.</p>
      <div className="rounded-xl border border-border bg-[repeating-linear-gradient(180deg,transparent,transparent_27px,rgba(148,163,184,0.15)_28px)] p-4">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={140}
          rows={2}
          placeholder="Write it here…"
          aria-label="What makes your business different"
          className="w-full resize-none bg-transparent text-[15px] font-medium italic leading-[28px] text-foreground outline-none placeholder:font-normal placeholder:not-italic placeholder:text-muted-foreground/40"
        />
        <div className="mt-1 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setText(ex)}
              className="rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[10.5px] font-medium text-muted-foreground hover:border-primary/40 hover:text-primary"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => text.trim().length > 0 && onDone(text.trim())}
        disabled={text.trim().length === 0}
        className="mx-auto mt-4 block rounded-full bg-primary px-5 py-2.5 text-[13.5px] font-semibold text-primary-foreground shadow-sm disabled:opacity-40"
      >
        Remember that
      </button>
    </div>
  );
}

/* --------------------------- Activation --------------------------- */

function ActivationOpen({ onSubmit, submitting, error }: { onSubmit: (email: string, password: string) => void; submitting: boolean; error: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const valid = signupSchema.safeParse({ email, password }).success;

  return (
    <div className="text-center">
      <p className="mb-1 text-[13.5px] font-bold">One more thing — this is what turns me on.</p>
      <p className="mb-4 text-[12px] text-muted-foreground">Create your login and I&apos;ll start answering for real.</p>
      <div className="space-y-2.5 text-left">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourbusiness.com"
          aria-label="Email address"
          className="h-12 w-full rounded-xl border-2 border-border bg-background px-3.5 text-[14px] font-semibold outline-none focus:border-primary"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          aria-label="Password"
          className="h-12 w-full rounded-xl border-2 border-border bg-background px-3.5 text-[14px] font-semibold outline-none focus:border-primary"
        />
      </div>
      {error && <p className="mt-2.5 text-[12.5px] font-medium text-destructive">{error}</p>}
      <button
        type="button"
        onClick={() => onSubmit(email, password)}
        disabled={!valid || submitting}
        className="mt-4 rounded-full bg-gradient-to-r from-primary to-success px-6 py-3 text-[14px] font-semibold text-white shadow-sm disabled:opacity-40"
      >
        {submitting ? "Bringing me online…" : "Bring me online"}
      </button>
    </div>
  );
}

/* ------------------------------- Panel ------------------------------- */

export function ReceptionistPanel() {
  const { reveal } = useReceptionistReveal();
  const [bornOrder, setBornOrder] = useState<StepId[]>([]);
  const [values, setValues] = useState<Values>({ businessName: "", trade: null, areas: [], opening: "", closing: "", memory: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activationTileRef = useRef<HTMLDivElement>(null);

  const current = SEQUENCE.find((id) => !bornOrder.includes(id)) ?? null;

  function born(id: StepId) {
    setBornOrder((prev) => [...prev, id]);
  }

  async function handleActivate(email: string, password: string) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError(signUpError.message);
        setSubmitting(false);
        return;
      }
      if (!data.session) {
        setError("Check your email to confirm your account, then come back and sign in.");
        setSubmitting(false);
        return;
      }

      const openDays = ["mon", "tue", "wed", "thu", "fri"];
      const res = await fetch("/api/onboarding/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: values.businessName,
          trade: values.trade,
          serviceAreas: values.areas,
          openDays,
          openingTime: values.opening,
          closingTime: values.closing,
          firstMemoryAnswer: values.memory,
        }),
      });
      if (!res.ok) {
        setError("That didn't quite go through. Try again.");
        setSubmitting(false);
        return;
      }

      const rect = activationTileRef.current?.getBoundingClientRect();
      reveal(
        rect
          ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
          : { top: window.innerHeight / 2 - 40, left: window.innerWidth / 2 - 80, width: 160, height: 80 },
        "/dashboard/receptionist/meet"
      );
    } catch {
      setError("That didn't quite go through. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {bornOrder.includes("identity") && (
            <SettledTile key="identity" label="Business Identity">
              <p className="truncate text-[16px] font-extrabold tracking-tight">{values.businessName}</p>
            </SettledTile>
          )}
          {bornOrder.includes("trade") && values.trade && (
            <SettledTile key="trade" label="Trade">
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = TRADE_ICONS[values.trade];
                  return <Icon className="h-4 w-4 text-primary" />;
                })()}
                <p className="text-[13.5px] font-bold">{ONBOARDING_TRADE_LABELS[values.trade]}</p>
              </div>
            </SettledTile>
          )}
          {bornOrder.includes("coverage") && (
            <SettledTile key="coverage" label="Coverage">
              <p className="truncate text-[13.5px] font-bold">{values.areas.join(", ")}</p>
            </SettledTile>
          )}
          {bornOrder.includes("hours") && (
            <SettledTile key="hours" label="Working Hours">
              <p className="text-[13.5px] font-bold">
                {formatTime12h(values.opening)} – {formatTime12h(values.closing)}
              </p>
            </SettledTile>
          )}
          {bornOrder.includes("knowledge") && (
            <SettledTile key="knowledge" label="Business Knowledge" big>
              <p className="text-[13px] font-semibold leading-snug">{values.memory}</p>
            </SettledTile>
          )}
          {bornOrder.includes("activation") && (
            <SettledTile key="activation" label="Receptionist Online">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success" />
                <p className="text-[13.5px] font-bold text-success">Active</p>
              </div>
            </SettledTile>
          )}

          {current === "identity" && (
            <OpenTile key="open-identity">
              <IdentityOpen onDone={(name) => { setValues((v) => ({ ...v, businessName: name })); born("identity"); }} />
            </OpenTile>
          )}
          {current === "trade" && (
            <OpenTile key="open-trade">
              <TradeOpen onDone={(t) => { setValues((v) => ({ ...v, trade: t })); born("trade"); }} />
            </OpenTile>
          )}
          {current === "coverage" && (
            <OpenTile key="open-coverage">
              <CoverageOpen onDone={(areas) => { setValues((v) => ({ ...v, areas })); born("coverage"); }} />
            </OpenTile>
          )}
          {current === "hours" && (
            <OpenTile key="open-hours">
              <HoursOpen trade={values.trade} onDone={(opening, closing) => { setValues((v) => ({ ...v, opening, closing })); born("hours"); }} />
            </OpenTile>
          )}
          {current === "knowledge" && (
            <OpenTile key="open-knowledge">
              <KnowledgeOpen onDone={(memory) => { setValues((v) => ({ ...v, memory })); born("knowledge"); }} />
            </OpenTile>
          )}
          {current === "activation" && (
            <OpenTile key="open-activation">
              <div ref={activationTileRef}>
                <ActivationOpen onSubmit={handleActivate} submitting={submitting} error={error} />
              </div>
            </OpenTile>
          )}
        </AnimatePresence>
      </div>

      {/* Waiting zone — honestly dormant, quiet, smaller. Real work
       * that hasn't happened yet, never faked into looking complete. */}
      <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-2.5">
        {WAITING_ITEMS.map((item) => (
          <div key={item.text} className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-border/70 p-2.5 opacity-60">
            <item.icon className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="text-center text-[9.5px] font-semibold leading-tight text-muted-foreground/60">{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
