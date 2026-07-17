"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Phone } from "lucide-react";
import { press, Reveal } from "@/components/shared/motion";
import { Acknowledgement, useAcknowledgement } from "@/components/shared/acknowledgement";
import { TypingDots } from "@/components/shared/typed-message";
import { createClient } from "@/lib/supabase/client";
import { buildStory, groupForStatus } from "@/lib/conversations";
import { cn } from "@/lib/utils";

/**
 * Opening a conversation tells the story, not just the messages
 * (Conversations Experience V2): what's been collected, where things
 * stand, and the obvious next action — Call, or Mark complete. The
 * owner understands the entire journey in seconds.
 */
export function ConversationStory({
  conversationId,
  status,
  customerPhone,
  messageCount,
  photoCount,
}: {
  conversationId: string;
  status: string;
  customerPhone: string;
  messageCount: number;
  photoCount: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const { message, isError, acknowledge, softError } = useAcknowledgement();
  const [saving, setSaving] = useState(false);

  const story = buildStory({ status, messageCount, photoCount });
  const group = groupForStatus(status);
  const isFinished = group === "done";

  async function markCompleted() {
    if (saving) return;
    setSaving(true);
    const { error } = await supabase
      .from("conversations")
      .update({ status: "completed" })
      .eq("id", conversationId);
    setSaving(false);
    if (error) {
      softError();
      return;
    }
    acknowledge("Nice. That one's finished.");
    router.refresh();
  }

  return (
    <div className="border-b border-border bg-muted/30 px-5 py-4">
      <div className="space-y-1.5">
        {story.map((moment, i) => (
          <Reveal key={moment.label} index={i}>
            <div className="flex items-center gap-2.5 text-[13px]">
              {moment.pending ? (
                <span className="flex h-4 w-4 items-center justify-center">
                  <TypingDots />
                </span>
              ) : (
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full",
                    moment.done ? "bg-success text-success-foreground" : "border border-border"
                  )}
                >
                  {moment.done && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
                </span>
              )}
              <span className={cn(moment.pending ? "font-semibold text-amber-600" : "text-muted-foreground")}>
                {moment.label}
              </span>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Primary actions are obvious — never hidden behind menus. */}
      <div className="mt-3.5 flex items-center gap-2">
        <motion.a
          {...press}
          href={`tel:${customerPhone}`}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-foreground shadow-sm"
        >
          <Phone className="h-3.5 w-3.5" />
          Call customer
        </motion.a>
        {!isFinished && (
          <motion.button
            {...press}
            type="button"
            onClick={markCompleted}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-[12.5px] font-semibold text-foreground disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" />
            Mark complete
          </motion.button>
        )}
        <Acknowledgement message={message} isError={isError} className="ml-1" />
      </div>
    </div>
  );
}
