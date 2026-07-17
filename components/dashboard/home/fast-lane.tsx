"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, CalendarClock, Headset, MessagesSquare, Smartphone } from "lucide-react";
import { press, SettleCard } from "@/components/shared/motion";
import { Acknowledgement, ACK, useAcknowledgement } from "@/components/shared/acknowledgement";
import { SwitchVisual } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { toDateString, type Availability } from "@/lib/availability";
import { cn } from "@/lib/utils";

/**
 * The twenty-second guarantee — nested inside her presence panel, not
 * floating beside it as a separate dashboard widget. Deliberate
 * hierarchy, not four equal tiles: who's waiting is the one thing
 * that can genuinely interrupt the owner's day, so it leads, larger
 * and on its own; the diary and teaching are quick, equal-weight
 * habits; her business knowledge earns its own identity (indigo, not
 * another grey settings shortcut) rather than competing for the same
 * visual space; marking today fully booked is a rare, occasional
 * flip, so it's the quietest thing here, not a tile at all.
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
  // Only the most recent save is allowed to update the acknowledgement
  // UI — see the identical fix and explanation in receptionist-playground.tsx.
  const requestId = useRef(0);

  /* Quiet persistence — debounced, never a Save button (same pattern
   * as the full diary at components/dashboard/availability/availability-diary.tsx). */
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(async () => {
      const thisRequest = ++requestId.current;
      startSaving();
      const { error } = await supabase.from("businesses").update({ availability }).eq("id", businessId);
      if (thisRequest !== requestId.current) return;
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
    <div className="space-y-2.5">
      {/* The one thing that can genuinely interrupt the day — leads,
       * larger, on its own. */}
      <Link href="/dashboard/conversations" className="block">
        <motion.div
          {...press}
          className={cn(
            "flex items-center gap-3.5 rounded-2xl border p-4 shadow-sm transition-colors",
            waitingCount > 0 ? "border-primary/25 bg-primary/[0.06]" : "border-border bg-muted/20"
          )}
        >
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
              waitingCount > 0 ? "bg-primary text-primary-foreground" : "bg-accent text-primary"
            )}
          >
            <MessagesSquare className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15.5px] font-bold tracking-tight">
              {waitingCount > 0
                ? `${waitingCount} ${waitingCount === 1 ? "person" : "people"} waiting`
                : "All caught up"}
            </p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              {waitingCount > 0 ? "Tap to see who needs you" : "Nobody's waiting on you right now"}
            </p>
          </div>
          <ArrowRight className={cn("h-4 w-4 shrink-0", waitingCount > 0 ? "text-primary" : "text-muted-foreground")} />
        </motion.div>
      </Link>

      {/* Quick, equal-weight habits. */}
      <div className="grid grid-cols-2 gap-2.5">
        <Tile href="/dashboard/availability" icon={<CalendarClock className="h-4 w-4" />}>
          <TileLabel label="Diary" detail={diaryLine} />
        </Tile>
        <Tile href="/dashboard/receptionist" icon={<Headset className="h-4 w-4" />}>
          <TileLabel label="Teach her" detail="Tone, rules, what to say" />
        </Tile>
      </div>

      {/* Her knowledge — its own identity, not another grey shortcut. */}
      <Link href="/dashboard/business" className="group block">
        <motion.div
          {...press}
          className="flex items-center gap-3 rounded-2xl border border-indigo-200/70 bg-indigo-50/50 p-3.5 shadow-sm"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold text-indigo-950">Everything she knows</p>
            <p className="mt-0.5 truncate text-[11.5px] text-indigo-700/70">
              Services, pricing, guarantees, and more
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-indigo-500 transition-transform group-hover:translate-x-0.5" />
        </motion.div>
      </Link>

      {/* A rare, occasional flip — deliberately the quietest thing here. */}
      <motion.button
        {...press}
        type="button"
        onClick={toggleFullyBooked}
        className={cn(
          "flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition-colors",
          fullyBooked ? "bg-amber-50 text-amber-800" : "text-muted-foreground hover:bg-muted/40"
        )}
      >
        <span className="text-[12.5px] font-medium">
          {fullyBooked ? "Fully booked today" : "Mark fully booked today?"}
        </span>
        <SwitchVisual checked={fullyBooked} />
      </motion.button>

      <div className="flex min-h-[20px] justify-center">
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
    <Link href={href} className="block">
      <motion.div
        {...press}
        className="flex h-full flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3 transition-colors hover:bg-muted/60"
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
