"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Lightbulb } from "lucide-react";
import { SettleCard, press, GentleSwap } from "@/components/shared/motion";
import { Acknowledgement, useAcknowledgement } from "@/components/shared/acknowledgement";
import { Textarea } from "@/components/ui/textarea";

/**
 * Learning Memory V1 — the owner-facing side of doc 12's four
 * confirmation outcomes. "Infer to propose, ask to confirm": everything
 * shown here is stated as the AI's own guess (`proposedLesson` is
 * always hedged, per propose-lesson.ts's own system prompt), and
 * nothing it says is written anywhere durable until one of these four
 * buttons is pressed.
 *
 * Its own dedicated card rather than squeezed into InsightList: this
 * needs four real actions, not just a line of text with an href — but
 * it still appears one at a time, quiet, on the page an owner already
 * checks, matching the same "one thing at a time" spirit InsightList
 * uses elsewhere.
 */

type Outcome = "confirm" | "ignore" | "clarify" | "defer";

export interface LearningProposal {
  id: string;
  proposedLesson: string;
}

export function LearningProposalCard({ proposal }: { proposal: LearningProposal }) {
  const [resolved, setResolved] = useState(false);
  const [clarifying, setClarifying] = useState(false);
  const [clarifyText, setClarifyText] = useState("");
  const [pending, setPending] = useState<Outcome | null>(null);
  const { message, isError, acknowledge, softError } = useAcknowledgement();

  async function resolve(action: Outcome, text?: string) {
    setPending(action);
    try {
      const res = await fetch(`/api/learning-proposals/${proposal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(text ? { action, text } : { action }),
      });
      if (!res.ok) {
        softError();
        setPending(null);
        return;
      }
      acknowledge(
        action === "confirm" || action === "clarify"
          ? "Perfect. I'll remember that."
          : action === "defer"
            ? "No problem — I'll ask again another time."
            : "Understood — I won't bring that up again."
      );
      setResolved(true);
    } catch {
      softError();
      setPending(null);
    }
  }

  if (resolved) {
    return (
      <SettleCard className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <Acknowledgement message={message} isError={isError} />
      </SettleCard>
    );
  }

  return (
    <SettleCard className="rounded-2xl border border-primary/15 bg-card p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lightbulb className="h-3.5 w-3.5" />
        </span>
        <p className="text-[13.5px] font-bold">Something I noticed</p>
      </div>
      <p className="mb-3.5 mt-1 text-[13px] leading-relaxed text-muted-foreground">{proposal.proposedLesson}</p>

      <GentleSwap swapKey={clarifying ? "clarify" : "options"}>
        {clarifying ? (
          <div className="space-y-2.5">
            <Textarea
              autoFocus
              value={clarifyText}
              onChange={(e) => setClarifyText(e.target.value)}
              placeholder="What should I actually remember?"
              className="min-h-[72px] text-[13px]"
            />
            <div className="flex flex-wrap gap-2">
              <motion.button
                {...press}
                type="button"
                disabled={!clarifyText.trim() || pending !== null}
                onClick={() => resolve("clarify", clarifyText)}
                className="rounded-full bg-primary px-3.5 py-1.5 text-[11.5px] font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
              >
                Save this instead
              </motion.button>
              <motion.button
                {...press}
                type="button"
                onClick={() => setClarifying(false)}
                className="rounded-full border border-border bg-card px-3.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                Never mind
              </motion.button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <motion.button
              {...press}
              type="button"
              disabled={pending !== null}
              onClick={() => resolve("confirm")}
              className="rounded-full bg-primary px-3.5 py-1.5 text-[11.5px] font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
            >
              Yes, remember that
            </motion.button>
            <motion.button
              {...press}
              type="button"
              disabled={pending !== null}
              onClick={() => setClarifying(true)}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 text-[11.5px] font-semibold text-foreground transition-colors hover:border-primary/40 disabled:opacity-50"
            >
              Not quite — let me clarify
            </motion.button>
            <motion.button
              {...press}
              type="button"
              disabled={pending !== null}
              onClick={() => resolve("defer")}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
            >
              Remind me later
            </motion.button>
            <motion.button
              {...press}
              type="button"
              disabled={pending !== null}
              onClick={() => resolve("ignore")}
              className="rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              No, ignore this
            </motion.button>
          </div>
        )}
      </GentleSwap>
    </SettleCard>
  );
}
