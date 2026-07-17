"use client";

import { motion } from "framer-motion";
import { EASE } from "@/components/shared/motion";
import { TypingDots, useTypedMessage } from "@/components/shared/typed-message";
import { cn } from "@/lib/utils";

/**
 * The live phone — one shared frame so the Receptionist playground,
 * onboarding demo, and Business "instant understanding" moments all
 * feel like the same product. Renders a realistic WhatsApp-style
 * thread; the final receptionist bubble is alive (pause / delete /
 * think / retype via useTypedMessage).
 */

export interface PreviewTurn {
  from: "customer" | "receptionist";
  text: string;
}

function Bubble({
  from,
  children,
  className,
}: {
  from: "customer" | "receptionist";
  children: React.ReactNode;
  className?: string;
}) {
  const isCustomer = from === "customer";
  return (
    <div className={cn("flex", isCustomer ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[82%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed shadow-sm",
          isCustomer
            ? "rounded-bl-md bg-white text-foreground"
            : "rounded-br-md bg-[#d7f8c8] text-foreground",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function PhonePreview({
  businessName,
  turns,
  liveReply,
  className,
}: {
  businessName: string;
  /** The settled part of the conversation. */
  turns: PreviewTurn[];
  /** The receptionist's latest reply — this one types itself. */
  liveReply: string;
  className?: string;
}) {
  const { display, isThinking } = useTypedMessage(liveReply);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[28px] border border-border bg-[#e7e1d8] shadow-md",
        className
      )}
    >
      {/* Chat header */}
      <div className="flex items-center gap-3 bg-[#075E54] px-4 py-3 text-white">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-[12px] font-bold">
          {businessName.slice(0, 1).toUpperCase() || "R"}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold leading-tight">{businessName}</p>
          <p className="text-[11px] leading-tight text-white/75">online</p>
        </div>
      </div>

      {/* Thread */}
      <div
        className="space-y-2 px-3 py-4"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 10%, rgba(255,255,255,0.35), transparent 40%)",
        }}
      >
        {turns.map((turn, i) => (
          <motion.div
            key={`${i}-${turn.text}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE, delay: i * 0.05 }}
          >
            <Bubble from={turn.from}>{turn.text}</Bubble>
          </motion.div>
        ))}

        <Bubble from="receptionist" className="min-h-[34px]">
          {isThinking || display.length === 0 ? (
            <TypingDots className="px-1 py-1" />
          ) : (
            <span>
              {display}
              <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse rounded bg-foreground/40 align-middle" />
            </span>
          )}
        </Bubble>
      </div>
    </div>
  );
}
