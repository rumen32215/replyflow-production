"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { SettleCard, press, EASE } from "@/components/shared/motion";
import { Acknowledgement, ACK, useAcknowledgement } from "@/components/shared/acknowledgement";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import {
  DAY_KEYS,
  DAY_LABELS,
  standingForDate,
  describeStanding,
  toDateString,
  type Availability,
  type DayKey,
} from "@/lib/availability";
import { cn } from "@/lib/utils";

/**
 * The receptionist's diary (Availability V1). The owner is not
 * managing a calendar — they're telling their receptionist "these are
 * the times I'm available." Today and tomorrow first (the two answers
 * that matter), the week beneath, then days off and booking rules.
 * Everything autosaves; the diary acknowledges each change.
 */
export function AvailabilityDiary({
  businessId,
  initial,
}: {
  businessId: string;
  initial: Availability;
}) {
  const supabase = createClient();
  const { message, isError, acknowledge, softError } = useAcknowledgement();
  const [availability, setAvailability] = useState<Availability>(initial);
  const [addingDayOff, setAddingDayOff] = useState(false);
  const [dayOffDate, setDayOffDate] = useState("");
  const [dayOffReason, setDayOffReason] = useState("");

  /* Quiet persistence — debounced, never a Save button. */
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(async () => {
      const { error } = await supabase
        .from("businesses")
        .update({ availability })
        .eq("id", businessId);
      if (error) softError();
      else acknowledge(ACK.diary);
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability]);

  function updateDay(key: DayKey, patch: Partial<Availability["hours"][DayKey]>) {
    setAvailability((a) => ({
      ...a,
      hours: { ...a.hours, [key]: { ...a.hours[key], ...patch } },
    }));
  }

  function updateRules(patch: Partial<Availability["rules"]>) {
    setAvailability((a) => ({ ...a, rules: { ...a.rules, ...patch } }));
  }

  function addDayOff() {
    if (!dayOffDate) return;
    setAvailability((a) => ({
      ...a,
      daysOff: [...a.daysOff.filter((d) => d.date !== dayOffDate), { date: dayOffDate, reason: dayOffReason.trim() || "Day off" }].sort(
        (x, y) => x.date.localeCompare(y.date)
      ),
    }));
    setAddingDayOff(false);
    setDayOffDate("");
    setDayOffReason("");
  }

  function removeDayOff(date: string) {
    setAvailability((a) => ({ ...a, daysOff: a.daysOff.filter((d) => d.date !== date) }));
  }

  function toggleFullyBookedToday() {
    const today = toDateString(new Date());
    setAvailability((a) => ({
      ...a,
      fullyBooked: a.fullyBooked.includes(today)
        ? a.fullyBooked.filter((d) => d !== today)
        : [...a.fullyBooked, today],
    }));
  }

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayStanding = standingForDate(availability, now);
  const tomorrowStanding = standingForDate(availability, tomorrow);
  const todayFullyBooked = availability.fullyBooked.includes(toDateString(now));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SettleCard>
        <h1 className="text-[24px] font-extrabold tracking-tight md:text-[26px]">The diary</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          I&apos;ll only ever offer customers times that genuinely work for you.
        </p>
      </SettleCard>

      {/* Today & tomorrow — the two answers that matter most. */}
      <SettleCard delay={0.05} className="grid grid-cols-2 gap-3">
        {[
          { label: "Today", standing: todayStanding },
          { label: "Tomorrow", standing: tomorrowStanding },
        ].map(({ label, standing }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
            <p
              className={cn(
                "mt-1.5 text-[15px] font-bold tracking-tight",
                standing.kind === "open" ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {describeStanding(standing)}
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {standing.kind === "open" ? "Taking bookings" : "No bookings offered"}
            </p>
          </div>
        ))}
      </SettleCard>

      {/* One honest shortcut for a hectic day. */}
      <SettleCard delay={0.08}>
        <motion.button
          {...press}
          type="button"
          onClick={toggleFullyBookedToday}
          className={cn(
            "flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-colors",
            todayFullyBooked ? "border-amber-300 bg-amber-50" : "border-border bg-card hover:bg-muted/40"
          )}
        >
          <div>
            <p className="text-[14px] font-semibold">{todayFullyBooked ? "Today is fully booked" : "Fully booked today?"}</p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              {todayFullyBooked
                ? "I'm offering customers the next available day instead."
                : "One tap and I'll offer customers the next available day."}
            </p>
          </div>
          <Switch checked={todayFullyBooked} aria-hidden className="pointer-events-none" />
        </motion.button>
      </SettleCard>

      {/* The week. */}
      <SettleCard delay={0.12} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-[15px] font-bold tracking-tight">Your usual week</h2>
        <p className="mb-4 mt-0.5 text-[12.5px] text-muted-foreground">These are the hours I&apos;ll book around.</p>
        <div className="space-y-1">
          {DAY_KEYS.map((key) => {
            const day = availability.hours[key];
            return (
              <div key={key} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <span className="w-24 shrink-0 text-[13.5px] font-semibold">{DAY_LABELS[key]}</span>
                <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                  <AnimatePresence mode="wait" initial={false}>
                    {day.closed ? (
                      <motion.span
                        key="closed"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, ease: EASE }}
                        className="text-[13px] text-muted-foreground"
                      >
                        Closed
                      </motion.span>
                    ) : (
                      <motion.span
                        key="times"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, ease: EASE }}
                        className="flex items-center gap-1.5"
                      >
                        <TimeInput value={day.open} onChange={(v) => updateDay(key, { open: v })} label={`${DAY_LABELS[key]} opening time`} />
                        <span className="text-[12px] text-muted-foreground">to</span>
                        <TimeInput value={day.close} onChange={(v) => updateDay(key, { close: v })} label={`${DAY_LABELS[key]} closing time`} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <Switch
                    checked={!day.closed}
                    onCheckedChange={(open) => updateDay(key, { closed: !open })}
                    aria-label={`${DAY_LABELS[key]} ${day.closed ? "closed" : "open"}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </SettleCard>

      {/* Days off. */}
      <SettleCard delay={0.16} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-[15px] font-bold tracking-tight">Days off</h2>
        <p className="mb-4 mt-0.5 text-[12.5px] text-muted-foreground">
          Holidays, family days, training — I&apos;ll never offer appointments on these.
        </p>

        {availability.daysOff.length > 0 && (
          <div className="mb-3 space-y-1.5">
            <AnimatePresence initial={false}>
              {availability.daysOff.map((dayOff) => (
                <motion.div
                  key={dayOff.date}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3.5 py-2.5"
                >
                  <div>
                    <p className="text-[13px] font-semibold">
                      {new Date(`${dayOff.date}T00:00:00`).toLocaleDateString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                    <p className="text-[12px] text-muted-foreground">{dayOff.reason}</p>
                  </div>
                  <motion.button
                    {...press}
                    type="button"
                    onClick={() => removeDayOff(dayOff.date)}
                    aria-label={`Remove day off on ${dayOff.date}`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </motion.button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {addingDayOff ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="space-y-2"
            >
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dayOffDate}
                  min={toDateString(new Date())}
                  onChange={(e) => setDayOffDate(e.target.value)}
                  aria-label="Date of day off"
                  className="h-11 flex-1 rounded-xl border border-border bg-background px-3 text-[13.5px] outline-none focus:border-primary"
                />
                <input
                  value={dayOffReason}
                  onChange={(e) => setDayOffReason(e.target.value)}
                  placeholder="Holiday"
                  aria-label="Reason"
                  className="h-11 flex-1 rounded-xl border border-border bg-background px-3 text-[13.5px] outline-none focus:border-primary"
                />
              </div>
              <div className="flex gap-2">
                <motion.button
                  {...press}
                  type="button"
                  onClick={addDayOff}
                  disabled={!dayOffDate}
                  className="rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Add day off
                </motion.button>
                <motion.button
                  {...press}
                  type="button"
                  onClick={() => setAddingDayOff(false)}
                  className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="add"
              {...press}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              type="button"
              onClick={() => setAddingDayOff(true)}
              className="flex items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              Add a day off
            </motion.button>
          )}
        </AnimatePresence>
      </SettleCard>

      {/* Booking rules. */}
      <SettleCard delay={0.2} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-[15px] font-bold tracking-tight">Booking rules</h2>
        <p className="mb-4 mt-0.5 text-[12.5px] text-muted-foreground">How I protect your time.</p>
        <div className="space-y-1">
          <RuleRow
            label="Same-day bookings"
            description="Let customers book for today"
            checked={availability.rules.sameDay}
            onChange={(v) => updateRules({ sameDay: v })}
          />
          <RuleRow
            label="Emergency call-outs"
            description="Accept urgent jobs outside normal hours"
            checked={availability.rules.emergency}
            onChange={(v) => updateRules({ emergency: v })}
          />
        </div>
      </SettleCard>

      <div className="sticky bottom-20 flex justify-center md:bottom-4">
        <Acknowledgement
          message={message}
          isError={isError}
          className="rounded-full border border-border bg-card px-4 py-2 shadow-md"
        />
      </div>
    </div>
  );
}

function TimeInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="h-9 rounded-lg border border-border bg-background px-2 text-[12.5px] font-medium outline-none focus:border-primary"
    />
  );
}

function RuleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl px-2 py-2.5">
      <div>
        <p className="text-[13.5px] font-semibold">{label}</p>
        <p className="text-[12px] text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
