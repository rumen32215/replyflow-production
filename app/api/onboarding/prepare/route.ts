import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureBusinessRow } from "@/lib/business";
import { DAY_KEYS, defaultAvailability, type DayKey } from "@/lib/availability";

export const dynamic = "force-dynamic";

/**
 * "Preparing your receptionist" — the moment the one-minute setup
 * completes. Called once from /onboarding/preparing with the five real
 * facts the V1 First-Run redesign collects: business name, trade,
 * service area, opening days, and opening hours
 * (DOCS/SPECS/ReplyFlow-V1-First-Run-Proposal.md).
 *
 * The businesses row already exists by this point (created in
 * /auth/callback the moment the session was established — see
 * lib/business.ts), so this endpoint's job is to:
 *
 *   1. Re-assert the row exists (defence in depth for accounts that
 *      predate the callback guarantee).
 *   2. Write the five facts the owner just told us — but ONLY while
 *      onboarding is still in progress. A business that has already
 *      completed onboarding is never overwritten: replaying this URL
 *      or double-submitting can't clobber personalised data.
 *   3. Flip onboarding_completed so the dashboard opens and never
 *      bounces the owner back into onboarding.
 *
 * Runs server-side with the caller's own session (RLS insert/update
 * policies on `businesses` allow owner_id = auth.uid()), so no
 * service-role key is involved. Inputs are treated as untrusted:
 * trimmed, control-characters stripped, length-capped, safe defaults.
 */

function sanitize(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength);
}

function isTimeString(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Body is optional — the flow always sends one, but the endpoint
  // stays safe to call bare.
  let body: {
    businessName?: unknown;
    trade?: unknown;
    serviceArea?: unknown;
    openDays?: unknown;
    openingTime?: unknown;
    closingTime?: unknown;
  } = {};
  try {
    body = await request.json();
  } catch {
    // No/invalid JSON body — proceed with defaults.
  }

  const { business, error: ensureError } = await ensureBusinessRow(supabase, user.id);
  if (ensureError || !business) {
    return NextResponse.json({ error: ensureError ?? "Business lookup failed" }, { status: 500 });
  }

  // Already fully set up (revisited URL, double submit, second tab):
  // success, and nothing the owner personalised is ever touched.
  // alreadyCompleted tells the caller (preparing-receptionist.tsx) this
  // is a repeat visit, not a fresh completion — Master Execution Plan
  // 0.2: the real-reasoning-pipeline demo conversation is a one-time
  // reveal, not something to re-run (and re-spend real OpenAI calls on)
  // every time this screen is revisited.
  if (business.onboarding_completed) {
    return NextResponse.json({ ok: true, alreadyCompleted: true });
  }

  const businessName = sanitize(body.businessName, 80) || business.business_name || "Your business";
  const trade = sanitize(body.trade, 60).toLowerCase() || business.trade || "plumbing";
  const serviceArea = sanitize(body.serviceArea, 80);
  const openingTime = isTimeString(body.openingTime) ? body.openingTime : "08:00";
  const closingTime = isTimeString(body.closingTime) ? body.closingTime : "17:30";
  const openDays = new Set(
    Array.isArray(body.openDays)
      ? body.openDays.filter((d): d is DayKey => DAY_KEYS.includes(d))
      : (["mon", "tue", "wed", "thu", "fri"] as DayKey[])
  );

  const availability = defaultAvailability(openingTime, closingTime);
  for (const day of DAY_KEYS) {
    availability.hours[day] = { ...availability.hours[day]!, closed: !openDays.has(day) };
  }

  const { error: updateError } = await supabase
    .from("businesses")
    .update({
      business_name: businessName,
      trade,
      service_areas: serviceArea ? [serviceArea] : [],
      opening_time: openingTime,
      closing_time: closingTime,
      availability,
      onboarding_completed: true,
    })
    .eq("id", business.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, alreadyCompleted: false });
}
