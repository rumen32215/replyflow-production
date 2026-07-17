"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CalendarClock, Headset, MessagesSquare, Smartphone } from "lucide-react";
import { press, SettleCard } from "@/components/shared/motion";
import { Acknowledgement, ACK, useAcknowledgement } from "@/components/shared/acknowledgement";
import { SwitchVisual } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { toDateString, type Availability } from "@/lib/availability";
import { cn } from "@/lib/utils";

/**
 * The twenty-second guarantee — routine actions live here, one tap
 * away, nested inside her presence panel rather than floating beside
 * it as a separate dashboard widget. Nothing here restates what her
 * presence line already said (Front Desk V3: one voice, not two).
 */

interface FastLaneProps {
  businessId: string;
  waitingCount: number;
  diaryLine: string;
  initialAvailability: Availability;
}

export function FastLane({ businessId, waitingCount, diaryLine, initialAvailability }: FastLaneProps) {
  const supabase = createClient();
  const { message, isError, isSaving, startSaving, acknowledge, softError } = useAcknowledgement();
  const [availability, setAvailability] = useState(initialAvailability);
  const firstRender = useRef(true);

  /* Quiet persistence — debounced, never a Save button (same pattern
   * as the full diary at components/dashboard/availability/availability-diary.tsx). */
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(async () => {
      startSaving();
      const { error } = await supabase.from("businesses").update({ availability }).eq("id", businessId);
      if (error) softError();
      else acknowledge(ACK.diary);
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability]);

  const today = toDateString(new Date());
  const fullyBooked = availability.fullyBooked.includes(today);

  function toggleFullyBooked() {
    setAvailability((a) => ({
      ...a,
      fullyBooked: a.fullyBooked.includes(today)
        ? a.fullyBooked.filter((d) => d !== today)
        : [...a.fullyBooked, today],
    }));
  }

  return (
    <div>
      <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
        <Link href="/dashboard/conversations" className="block shrink-0 md:shrink md:flex-1">
          <motion.div
            {...press}
            className="flex h-full min-w-[120px] items-center gap-2.5 rounded-xl border border-border bg-muted/30 p-3 transition-colors hover:bg-muted/60 md:min-w-[140px]"
          >
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
              <MessagesSquare className="h-4 w-4" />
              {waitingCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9.5px] font-bold leading-none text-white">
                  {waitingCount}
                </span>
              )}
            </div>
            <p className="text-[13px] font-semibold leading-tight">Conversations</p>
          </motion.div>
        </Link>

        <motion.button
          {...press}
          type="button"
          onClick={toggleFullyBooked}
          className={cn(
            "flex h-full min-w-[152px] shrink-0 flex-col gap-2 rounded-xl border p-3 text-left transition-colors md:min-w-[168px] md:flex-1",
            fullyBooked ? "border-amber-300 bg-amber-50" : "border-border bg-muted/30 hover:bg-muted/60"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary">
              <CalendarClock className="h-4 w-4" />
            </div>
            <SwitchVisual checked={fullyBooked} />
          </div>
          <TileLabel
            label={fullyBooked ? "Fully booked today" : "Fully booked today?"}
            detail={fullyBooked ? "Offering the next available day instead." : "One tap to close today's diary."}
          />
        </motion.button>

        <Tile href="/dashboard/availability" icon={<CalendarClock className="h-4 w-4" />}>
          <TileLabel label="Today's diary" detail={diaryLine} />
        </Tile>

        <Tile href="/dashboard/receptionist" icon={<Headset className="h-4 w-4" />}>
          <TileLabel label="Teach her something" detail="Tone, rules, what to say" />
        </Tile>
      </div>

      <div className="mt-2 flex min-h-[20px] justify-center md:justify-start">
        <Acknowledgement message={message} isError={isError} isSaving={isSaving} className="text-[12px]" />
      </div>
    </div>
  );
}

/**
 * A different kind of action from the routine fast lane — connecting
 * WhatsApp is a one-time, load-bearing step (she can't do her job at
 * all without it), not a daily habit like marking today fully booked.
 * It earns its own prominent banner rather than sharing a tile row.
 */
export function ConnectWhatsAppBanner() {
  return (
    <SettleCard delay={0.03}>
      <Link href="/dashboard/whatsapp" className="group block">
        <motion.div
          {...press}
          className="flex items-center gap-3.5 rounded-2xl bg-primary p-4 text-primary-foreground shadow-md"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-bold">Connect WhatsApp</p>
            <p className="mt-0.5 text-[12.5px] text-primary-foreground/85">
              I&apos;m ready — I just can&apos;t hear your customers yet.
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </motion.div>
      </Link>
    </SettleCard>
  );
}

function Tile({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link href={href} className="block shrink-0 md:shrink md:flex-1">
      <motion.div
        {...press}
        className="flex h-full min-w-[152px] flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3 transition-colors hover:bg-muted/60 md:min-w-[168px]"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary">{icon}</div>
        {children}
      </motion.div>
    </Link>
  );
}

function TileLabel({ label, detail }: { label: string; detail: string }) {
  return (
    <div>
      <p className="text-[13px] font-semibold leading-tight">{label}</p>
      <p className="mt-0.5 truncate text-[11.5px] leading-snug text-muted-foreground">{detail}</p>
    </div>
  );
}
