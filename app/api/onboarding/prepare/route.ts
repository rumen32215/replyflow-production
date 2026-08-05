import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureBusinessRow } from "@/lib/business";
import { DAY_KEYS, defaultAvailability, type DayKey } from "@/lib/availability";
import { recordProductEvent } from "@/lib/product-events";
import { recordErrorEvent } from "@/lib/error-events";
import { parseKnowledge } from "@/lib/knowledge";
import { applyCustomerType, selectDiscovery } from "@/lib/onboarding-script";

export const dynamic = "force-dynamic";

/**
 * "Preparing your receptionist" — the moment the one-minute setup
 * completes. Called once from /onboarding/preparing with the five real
 * facts the V1 First-Run redesign collects: business name, trade,
 * service area(s), opening days, and opening hours
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
    serviceAreas?: unknown;
    openDays?: unknown;
    openingTime?: unknown;
    closingTime?: unknown;
    worksCommercial?: unknown;
    discoveryAccepted?: unknown;
  } = {};
  try {
    body = await request.json();
  } catch {
    // No/invalid JSON body — proceed with defaults.
  }

  const { business, error: ensureError } = await ensureBusinessRow(supabase, user.id);
  if (ensureError || !business) {
    // A business with no row can never reach the dashboard — this is
    // the one step every signup passes through, so a silent failure
    // here means someone stuck at onboarding forever with no trace.
    await recordErrorEvent({
      severity: "error",
      source: "onboarding.prepare_failed",
      businessId: null,
      message: `ensureBusinessRow failed during onboarding completion: ${ensureError ?? "no business returned"}`,
    });
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
  const serviceAreas = Array.isArray(body.serviceAreas)
    ? body.serviceAreas.map((a) => sanitize(a, 80)).filter(Boolean).slice(0, 20)
    : [];
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

  // V21.6 — genuine curiosity, not required configuration: both of
  // these are `null` when skipped or dismissed, and that's a fully
  // valid, expected value (doc 15 §0, `lib/onboarding-script.ts`).
  // Onboarding is always the first writer to business_knowledge (the
  // `onboarding_completed` guard above guarantees this code path only
  // ever runs once per business), so building fresh from an empty base
  // is correct, not a shortcut — there's nothing prior to merge with.
  const worksCommercial = body.worksCommercial === "domestic" || body.worksCommercial === "both" ? body.worksCommercial : null;
  const discoveryAccepted = typeof body.discoveryAccepted === "boolean" ? body.discoveryAccepted : null;

  let knowledge = applyCustomerType(parseKnowledge(null), worksCommercial);
  if (discoveryAccepted) {
    const discovery = selectDiscovery({ trade, businessName, serviceAreas });
    if (discovery) knowledge = discovery.onAccept(knowledge);
  }

  const { error: updateError } = await supabase
    .from("businesses")
    .update({
      business_name: businessName,
      trade,
      service_areas: serviceAreas,
      opening_time: openingTime,
      closing_time: closingTime,
      availability,
      business_knowledge: knowledge,
      onboarding_completed: true,
    })
    .eq("id", business.id);

  if (updateError) {
    await recordErrorEvent({
      severity: "error",
      source: "onboarding.prepare_failed",
      businessId: business.id,
      message: "Failed to save onboarding facts and flip onboarding_completed — this business is stuck at onboarding.",
      error: updateError,
    });
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Master Execution Plan 3.2 — genuinely new: onboarding_completed is
  // a boolean with no history behind it (every prior update just
  // overwrites it) — this is the only durable record of when a
  // business actually finished the signup wizard. The early return
  // above (business.onboarding_completed already true) guarantees this
  // line only runs on a genuine first completion, never a repeat visit.
  await recordProductEvent({ eventType: "onboarding.signup_completed", businessId: business.id });

  return NextResponse.json({ ok: true, alreadyCompleted: false });
}
