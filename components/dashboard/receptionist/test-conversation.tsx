"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowRight, Loader2, RotateCcw, Send } from "lucide-react";
import { SettleCard, press, EASE } from "@/components/shared/motion";
import { Bubble } from "@/components/shared/phone-preview";
import { TypingDots } from "@/components/shared/typed-message";
import { intentLabel, factSourceSummary, ConfidenceTag } from "@/components/dashboard/conversations/conversation-story";
import { scenariosForTrade } from "@/lib/receptionist";
import { cn } from "@/lib/utils";

interface Turn {
  from: "customer" | "receptionist";
  text: string;
  intent?: string;
  confidence?: string;
  requiresEscalation?: boolean;
  escalationReason?: string | null;
  factsUsed?: string[] | null;
  notReady?: boolean;
  noReplyNeeded?: boolean;
}

/** Where "fix this" sends the owner — a light, honest best-guess from
 * the category, not a claim of precision. Falls back to the general
 * teaching hub rather than getting this wrong. */
const FIX_HREF: Record<string, string> = {
  pricing: "/dashboard/receptionist?topic=rules",
  booking: "/dashboard/receptionist?topic=behaviours",
  change_booking: "/dashboard/receptionist?topic=behaviours",
  cancellation: "/dashboard/receptionist?topic=behaviours",
  complaint: "/dashboard/receptionist?topic=escalation",
  emergency: "/dashboard/receptionist?topic=escalation",
  payment: "/dashboard/business?topic=payments",
};

export function TestConversation({
  businessName,
  trade,
  receptionistName,
}: {
  businessName: string;
  trade: string | null;
  receptionistName: string | null;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const name = receptionistName || "your receptionist";
  const scenarios = scenariosForTrade(trade);
  const starters = [
    scenarios.find((s) => s.kind === "standard"),
    scenarios.find((s) => s.kind === "quote"),
    scenarios.find((s) => s.kind === "price"),
    scenarios.find((s) => s.kind === "emergency"),
  ].filter((s): s is NonNullable<typeof s> => Boolean(s));
  const COMPLAINT_STARTER = "Honestly, I'm pretty unhappy — this is the second time I've had to chase you about this.";

  async function send(messageBody: string) {
    if (sending || !messageBody.trim()) return;
    setSending(true);
    setError(null);
    setTurns((t) => [...t, { from: "customer", text: messageBody }]);
    setInput("");
    try {
      const res = await fetch("/api/receptionist/test-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageBody }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "Something went wrong — try again.");
        setSending(false);
        return;
      }
      if (payload.notReady) {
        setTurns((t) => [...t, { from: "receptionist", text: payload.message, notReady: true }]);
      } else {
        const d = payload.draft;
        const text = d.final_text ?? d.draft_text ?? "";
        setTurns((t) => [
          ...t,
          {
            from: "receptionist",
            text,
            intent: d.intent,
            confidence: d.confidence,
            requiresEscalation: d.requires_escalation,
            escalationReason: d.escalation_reason,
            factsUsed: d.facts_used,
            noReplyNeeded: d.status === "no_reply_needed",
          },
        ]);
      }
      setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {
      setError("Couldn't reach the server — try again.");
    } finally {
      setSending(false);
    }
  }

  async function reset() {
    if (resetting) return;
    setResetting(true);
    try {
      await fetch("/api/receptionist/test-conversation", { method: "DELETE" });
      setTurns([]);
      setError(null);
    } finally {
      setResetting(false);
    }
  }

  const realExchangeCount = turns.filter((t) => t.from === "receptionist" && !t.notReady).length;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <SettleCard>
        <h1 className="text-[24px] font-extrabold tracking-tight md:text-[26px]">Try {name}</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
          Want to see how I&apos;d actually handle something? Try me — this never touches a real customer.
        </p>
      </SettleCard>

      {turns.length === 0 && (
        <SettleCard delay={0.08} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="mb-3 text-[13.5px] font-bold">Try to break me.</p>
          <p className="mb-3.5 text-[12.5px] leading-relaxed text-muted-foreground">
            Real questions a customer might send — including the awkward ones. Tap one, or type your own below.
          </p>
          <div className="flex flex-wrap gap-2">
            {starters.map((s) => (
              <motion.button
                key={s.id}
                {...press}
                type="button"
                onClick={() => send(s.customerMessage)}
                className="rounded-full border border-border bg-muted/40 px-3.5 py-2 text-left text-[12.5px] font-medium text-foreground transition-colors hover:border-primary/30"
              >
                {s.customerMessage}
              </motion.button>
            ))}
            <motion.button
              {...press}
              type="button"
              onClick={() => send(COMPLAINT_STARTER)}
              className="rounded-full border border-border bg-muted/40 px-3.5 py-2 text-left text-[12.5px] font-medium text-foreground transition-colors hover:border-primary/30"
            >
              {COMPLAINT_STARTER}
            </motion.button>
          </div>
        </SettleCard>
      )}

      {turns.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          {turns.map((turn, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }}>
              <Bubble from={turn.from}>{turn.text}</Bubble>
              {turn.from === "receptionist" && !turn.notReady && (
                <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1.5 pr-1">
                  {turn.confidence && <ConfidenceTag confidence={turn.confidence} />}
                  {turn.intent && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                      {intentLabel(turn.intent)}
                    </span>
                  )}
                </div>
              )}
              {turn.requiresEscalation && (
                <div className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-[12px] leading-relaxed text-amber-900">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{turn.escalationReason || "This one needs your judgement before it would ever send."}</span>
                </div>
              )}
              {turn.noReplyNeeded && (
                <p className="mt-1.5 pr-1 text-right text-[11.5px] italic text-muted-foreground">
                  She judged no reply was needed here — silence was the right call.
                </p>
              )}
              {factSourceSummary(turn.factsUsed) && (
                <p className="mt-1 pr-1 text-right text-[11px] text-muted-foreground">
                  Why she said that: based on {factSourceSummary(turn.factsUsed)}.
                </p>
              )}
              {turn.from === "receptionist" && !turn.notReady && (
                <div className="mt-1 flex justify-end">
                  <Link
                    href={FIX_HREF[intentCategory(turn)] ?? "/dashboard/receptionist"}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Something not right? Fix it
                  </Link>
                </div>
              )}
            </motion.div>
          ))}
          {sending && (
            <div className="flex justify-end">
              <Bubble from="receptionist">
                <TypingDots className="px-1 py-1" />
              </Bubble>
            </div>
          )}
          <div ref={threadEndRef} />
        </div>
      )}

      {error && <p className="text-[12.5px] text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Type what a customer might say…"
          disabled={sending}
          className="min-h-[48px] flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-[13.5px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary disabled:opacity-60"
        />
        <motion.button
          {...press}
          type="button"
          onClick={() => send(input)}
          disabled={sending || !input.trim()}
          className="flex min-h-[48px] shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-sm disabled:opacity-60"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send
        </motion.button>
      </div>

      {turns.length > 0 && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={reset}
            disabled={resetting}
            className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
          >
            <RotateCcw className="h-3 w-3" />
            Start a fresh test conversation
          </button>
        </div>
      )}

      <AnimatePresence>
        {realExchangeCount >= 1 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}>
            <SettleCard className="rounded-2xl border border-success/25 bg-success/5 p-5 shadow-sm">
              <p className="text-[14px] font-bold">How does that feel?</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Ready to connect {name} to your real customers? Nothing sends automatically until you say so — every reply still
                comes to you first.
              </p>
              <Link href="/dashboard/whatsapp" className="mt-3 inline-block">
                <motion.span
                  {...press}
                  className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-sm"
                >
                  Connect WhatsApp
                  <ArrowRight className="h-3.5 w-3.5" />
                </motion.span>
              </Link>
            </SettleCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Maps a raw Understanding Engine intent down to the small set of
 * FIX_HREF categories worth a specific deep link — everything else
 * falls back to the general teaching hub rather than guessing wrong. */
function intentCategory(turn: Turn): string {
  switch (turn.intent) {
    case "PRICING_INQUIRY":
      return "pricing";
    case "BOOKING_REQUEST":
      return "booking";
    case "BOOKING_CHANGE":
      return "change_booking";
    case "BOOKING_CANCELLATION":
      return "cancellation";
    case "COMPLAINT":
      return "complaint";
    case "EMERGENCY":
      return "emergency";
    case "PAYMENT_QUERY":
      return "payment";
    default:
      return "";
  }
}
