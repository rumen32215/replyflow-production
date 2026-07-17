"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { SettleCard, press, EASE } from "@/components/shared/motion";
import { Acknowledgement, ACK, useAcknowledgement } from "@/components/shared/acknowledgement";
import { Switch, SwitchVisual } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import {
  DAY_KEYS,
  DAY_LABELS,
  standingForDate,
  describeStanding,
  describeBookingReply,
  toDateString,
  dayKeyForDate,
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
  const { message, isError, isSaving, startSaving, acknowledge, softError } = useAcknowledgement();
  const [availability, setAvailability] = useState<Availability>(initial);
  const [addingDayOff, setAddingDayOff] = useState(false);
  const [dayOffDate, setDayOffDate] = useState("");
  const [dayOffReason, setDayOffReason] = useState("");

  /* Quiet persistence — debounced, never a Save button. */
  const firstRender = useRef(true);
  // Only the most recent save is allowed to update the acknowledgement
  // UI — see the identical fix and explanation in receptionist-playground.tsx.
  const requestId = useRef(0);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(async () => {
      const thisRequest = ++requestId.current;
      startSaving();
      const { error } = await supabase
        .from("businesses")
        .update({ availability })
        .eq("id", businessId);
      if (thisRequest !== requestId.current) return;
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
  // Named, not just "Today"/"Tomorrow" — makes it obvious this is
  // computed live from the real date, not a fixed label.
  const todayWeekday = now.toLocaleDateString("en-GB", { weekday: "long" });
  const tomorrowWeekday = tomorrow.toLocaleDateString("en-GB", { weekday: "long" });
  // The same "teach it, watch it" proof Receptionist and Business
  // Knowledge already have — every rule change below visibly changes
  // what she'd actually say.
  const liveReply = describeBookingReply(availability, now);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SettleCard>
        <h1 className="text-[24px] font-extrabold tracking-tight md:text-[26px]">The diary</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          I&apos;ll only ever offer customers times that genuinely work for you.
        </p>
      </SettleCard>

      {/* Today leads — the one answer that actually matters right now. */}
      <SettleCard
        delay={0.05}
        className="rounded-2xl border border-yellow-200/60 bg-yellow-50/40 p-5 shadow-sm"
      >
        <p className="text-[11px] font-bold uppercase tracking-widest text-yellow-700/70">Today · {todayWeekday}</p>
        <p
          className={cn(
            "mt-1.5 text-[20px] font-extrabold tracking-tight",
            todayStanding.kind === "open" ? "text-yellow-950" : "text-muted-foreground"
          )}
        >
          {describeStanding(todayStanding)}
        </p>
        <p className="mt-0.5 text-[12.5px] text-yellow-800/60">
          {todayStanding.kind === "open" ? "Taking bookings" : "No bookings offered"}
        </p>
      </SettleCard>

      {/* Tomorrow is a glance, not a card of its own. */}
      <SettleCard
        delay={0.07}
        className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3"
      >
        <span className="text-[12.5px] font-medium text-muted-foreground">Tomorrow · {tomorrowWeekday}</span>
        <span className={cn("text-[13px] font-semibold", tomorrowStanding.kind !== "open" && "text-muted-foreground")}>
          {describeStanding(tomorrowStanding)}
        </span>
      </SettleCard>

      {/* One honest shortcut for a hectic day. */}
      <SettleCard delay={0.09}>
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
          <SwitchVisual checked={todayFullyBooked} />
        </motion.button>
      </SettleCard>

      {/* The week. */}
      <SettleCard delay={0.12} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-[15px] font-bold tracking-tight">Your usual week</h2>
        <p className="mb-4 mt-0.5 text-[12.5px] text-muted-foreground">These are the hours I&apos;ll book around.</p>
        <div className="space-y-1">
          {DAY_KEYS.map((key) => {
            const day = availability.hours[key];
            const isToday = key === dayKeyForDate(now);
            return (
              <div
                key={key}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-2 py-2 transition-colors",
                  isToday && "bg-yellow-50/60 ring-1 ring-inset ring-yellow-200/50",
                  day.closed && !isToday && "opacity-60"
                )}
              >
                <span className="flex w-24 shrink-0 items-center gap-1.5 text-[13.5px] font-semibold">
                  {DAY_LABELS[key]}
                  {isToday && <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" aria-hidden />}
                </span>
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
                  className="h-11 flex-1 rounded-xl border border-border bg-background px-3 text-[13.5px] outline-none focus:border-yellow-500"
                />
                <input
                  value={dayOffReason}
                  onChange={(e) => setDayOffReason(e.target.value)}
                  placeholder="Holiday"
                  aria-label="Reason"
                  className="h-11 flex-1 rounded-xl border border-border bg-background px-3 text-[13.5px] outline-none focus:border-yellow-500"
                />
              </div>
              <div className="flex gap-2">
                <motion.button
                  {...press}
                  type="button"
                  onClick={addDayOff}
                  disabled={!dayOffDate}
                  className="rounded-xl bg-yellow-600 px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
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
              className="flex items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:border-yellow-400 hover:text-yellow-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add a day off
            </motion.button>
          )}
        </AnimatePresence>
      </SettleCard>

      {/* Booking rules — what actually protects a tradesperson's time,
       * not just two toggles. */}
      <SettleCard delay={0.2} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-[15px] font-bold tracking-tight">Booking rules</h2>
        <p className="mb-3 mt-0.5 text-[12.5px] text-muted-foreground">How I protect your time.</p>

        {/* The same "teach it, watch it" proof as Receptionist and
         * Business Knowledge — change a rule, watch this change. */}
        <div className="mb-4 rounded-xl bg-yellow-50/60 px-3.5 py-3">
          <p className="mb-1 text-[10.5px] font-bold uppercase tracking-widest text-yellow-700/70">
            If someone asks &quot;are you free today?&quot;
          </p>
          <p className="text-[13px] italic leading-relaxed text-yellow-950">{liveReply}</p>
        </div>

        <div className="divide-y divide-border">
          <RuleRow
            label="Same-day bookings"
            description="I'll offer today's slots to customers while they're free"
            checked={availability.rules.sameDay}
            onChange={(v) => updateRules({ sameDay: v })}
          />
          <div className="py-2.5">
            <RuleRow
              label="Emergency call-outs"
              description="I'll fit urgent jobs in outside normal hours when it's genuinely needed"
              checked={availability.rules.emergency}
              onChange={(v) => updateRules({ emergency: v })}
              noPadding
            />
            <AnimatePresence initial={false}>
              {availability.rules.emergency && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.28, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="pt-2">
                    <input
                      value={availability.rules.emergencyHours}
                      onChange={(e) => updateRules({ emergencyHours: e.target.value })}
                      placeholder="When? e.g. 24/7, or weekdays after 6pm"
                      aria-label="When emergency call-outs are available"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] outline-none focus:border-yellow-500"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <RuleRow
            label="Only emergency jobs at weekends"
            description="I'll protect your weekend — only genuine emergencies get offered Saturday and Sunday"
            checked={availability.rules.weekendEmergencyOnly}
            onChange={(v) => updateRules({ weekendEmergencyOnly: v })}
          />

          <ChipRow
            label="How much notice do I need?"
            description="I'll never book you in with less warning than this, so you're never caught out"
            options={[
              { label: "None", value: 0 },
              { label: "2 hours", value: 2 },
              { label: "4 hours", value: 4 },
              { label: "24 hours", value: 24 },
            ]}
            value={availability.rules.minNoticeHours}
            onChange={(v) => updateRules({ minNoticeHours: v })}
            customUnit="hours"
          />

          <ChipRow
            label="Most jobs in one day"
            description="I'll start saying the day's full once we reach this, so you're never overloaded"
            options={[
              { label: "No limit", value: null },
              { label: "2", value: 2 },
              { label: "4", value: 4 },
              { label: "6", value: 6 },
              { label: "8", value: 8 },
            ]}
            value={availability.rules.maxJobsPerDay}
            onChange={(v) => updateRules({ maxJobsPerDay: v })}
            customUnit="jobs"
          />

          <ChipRow
            label="Travel time between jobs"
            description="I'll always leave this much time so you're never rushed getting to the next one"
            options={[
              { label: "None", value: 0 },
              { label: "15 min", value: 15 },
              { label: "30 min", value: 30 },
              { label: "45 min", value: 45 },
              { label: "60 min", value: 60 },
            ]}
            value={availability.rules.travelBufferMinutes}
            onChange={(v) => updateRules({ travelBufferMinutes: v })}
            customUnit="minutes"
          />

          <ChipRow
            label="Working radius"
            description="I'll only offer jobs within this distance, so you're never driving further than makes sense"
            options={[
              { label: "5 miles", value: 5 },
              { label: "10 miles", value: 10 },
              { label: "15 miles", value: 15 },
              { label: "20 miles", value: 20 },
              { label: "No limit", value: null },
            ]}
            value={availability.rules.workingRadiusMiles}
            onChange={(v) => updateRules({ workingRadiusMiles: v })}
            customUnit="miles"
          />

          <div className="py-2.5">
            <RuleRow
              label="Block out a lunch break"
              description="I'll never book over this window, so you always get a proper break"
              checked={availability.rules.lunchBreak.enabled}
              onChange={(v) => updateRules({ lunchBreak: { ...availability.rules.lunchBreak, enabled: v } })}
            />
            <AnimatePresence initial={false}>
              {availability.rules.lunchBreak.enabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.28, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-2 pb-1 pt-2">
                    <TimeInput
                      value={availability.rules.lunchBreak.start}
                      onChange={(v) => updateRules({ lunchBreak: { ...availability.rules.lunchBreak, start: v } })}
                      label="Lunch break start"
                    />
                    <span className="text-[12px] text-muted-foreground">to</span>
                    <TimeInput
                      value={availability.rules.lunchBreak.end}
                      onChange={(v) => updateRules({ lunchBreak: { ...availability.rules.lunchBreak, end: v } })}
                      label="Lunch break end"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </SettleCard>

      <div className="sticky bottom-20 flex justify-center md:bottom-4">
        <Acknowledgement
          message={message}
          isError={isError}
          isSaving={isSaving}
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
      className="h-9 rounded-lg border border-border bg-background px-2 text-[12.5px] font-medium outline-none focus:border-yellow-500"
    />
  );
}

function RuleRow({
  label,
  description,
  checked,
  onChange,
  noPadding = false,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  noPadding?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between", !noPadding && "px-2 py-2.5")}>
      <div>
        <p className="text-[13.5px] font-semibold">{label}</p>
        <p className="text-[12px] text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

/** A rule that's a choice, not a toggle — same divided-list rhythm as
 * the switches above, chips instead of a number input (Diary V2: keep
 * it conversational, not a form field). */
function ChipRow<T extends string | number | null>({
  label,
  description,
  options,
  value,
  onChange,
  customUnit,
}: {
  label: string;
  description: string;
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  /** When set, adds a "Custom" chip revealing a number input — for
   * values a fixed set of chips can't anticipate (Diary V2: "allow
   * custom values where appropriate"). */
  customUnit?: string;
}) {
  const matchesPreset = options.some((o) => o.value === value);
  const [showCustom, setShowCustom] = useState(Boolean(customUnit) && !matchesPreset && value !== null);

  return (
    <div className="px-2 py-2.5">
      <p className="text-[13.5px] font-semibold">{label}</p>
      <p className="text-[12px] text-muted-foreground">{description}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((option) => {
          const on = !showCustom && option.value === value;
          return (
            <motion.button
              key={String(option.value)}
              {...press}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setShowCustom(false);
                onChange(option.value);
              }}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] transition-all",
                on
                  ? "bg-yellow-600 font-semibold text-white shadow-sm shadow-yellow-600/25"
                  : "border border-border bg-card font-medium text-muted-foreground hover:text-foreground"
              )}
            >
              {option.label}
            </motion.button>
          );
        })}
        {customUnit && (
          <motion.button
            {...press}
            type="button"
            aria-pressed={showCustom}
            onClick={() => setShowCustom(true)}
            className={cn(
              "rounded-full px-3 py-1.5 text-[12px] transition-all",
              showCustom
                ? "bg-yellow-600 font-semibold text-white shadow-sm shadow-yellow-600/25"
                : "border border-dashed border-border bg-card font-medium text-muted-foreground hover:text-foreground"
            )}
          >
            Custom
          </motion.button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {customUnit && showCustom && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={typeof value === "number" ? value : ""}
                onChange={(e) => {
                  const n = e.target.value === "" ? null : Number(e.target.value);
                  onChange(n as unknown as T);
                }}
                placeholder="e.g. 3"
                aria-label={`Custom ${label}`}
                className="h-9 w-24 rounded-lg border border-border bg-background px-2.5 text-[12.5px] outline-none focus:border-yellow-500"
              />
              <span className="text-[12px] text-muted-foreground">{customUnit}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
