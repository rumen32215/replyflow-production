import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseKnowledge } from "@/lib/knowledge";
import { parseAvailability, describeBookingReply, nextAvailableSlot } from "@/lib/availability";
import { generateLiveReply } from "@/lib/reply-engine/live-reply";
import { toConversationState } from "@/lib/reply-engine/understanding";

export const dynamic = "force-dynamic";

/**
 * Coaching Implementation Plan, C1 — a real, DB-free example reply.
 * Auth-gated to the caller's own business; reads that business's real,
 * already-saved profile/diary/FAQ facts (not being edited on this
 * page), and takes only tone/behaviours/rules/escalation from the
 * request body — the owner's current, possibly-unsaved draft teaching
 * state. Never writes anything; never requires a real conversation.
 *
 * RC6: optionally accepts `priorState`/`recentHistory` so a caller
 * (onboarding's demo conversation) can thread real turn-by-turn memory
 * across several calls — the same ConversationState a real, persisted
 * conversation carries forward, just never written to a database here.
 * Both are parsed defensively via toConversationState/plain filtering,
 * exactly like state read back from any other untrusted source —
 * malformed input degrades to "no memory" rather than ever crashing
 * the pipeline. Omitted, behaviour is identical to before this change.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: {
    scenarioMessage?: unknown;
    tone?: unknown;
    behaviours?: unknown;
    businessRules?: unknown;
    escalationRules?: unknown;
    priorState?: unknown;
    recentHistory?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const scenarioMessage = typeof body.scenarioMessage === "string" ? body.scenarioMessage.trim() : "";
  if (!scenarioMessage) return NextResponse.json({ error: "Missing scenarioMessage" }, { status: 400 });

  function isHistoryMessage(m: unknown): m is { direction: "inbound" | "outbound"; body: string } {
    if (!m || typeof m !== "object") return false;
    const r = m as Record<string, unknown>;
    return (r.direction === "inbound" || r.direction === "outbound") && typeof r.body === "string";
  }

  const priorState = body.priorState ? toConversationState(body.priorState) : undefined;
  const recentHistory = Array.isArray(body.recentHistory)
    ? body.recentHistory
        .filter(isHistoryMessage)
        .slice(-15)
        .map((m) => ({ direction: m.direction, body: m.body, createdAt: new Date().toISOString() }))
    : undefined;

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select(
      "id, business_name, trade, business_description, services, service_areas, opening_time, closing_time, offers_emergency_callouts, charges_callout_fee, callout_fee_amount, receptionist_name, business_knowledge, availability"
    )
    .eq("owner_id", user.id)
    .maybeSingle();
  if (businessError) return NextResponse.json({ error: businessError.message }, { status: 500 });
  if (!business) return NextResponse.json({ error: "No business found" }, { status: 404 });

  const { data: config } = await supabase.from("ai_configurations").select("faqs").eq("business_id", business.id).maybeSingle();

  const availability = parseAvailability(business.availability, business.opening_time, business.closing_time);
  const now = new Date();

  try {
    const result = await generateLiveReply(
      business.id,
      scenarioMessage,
      {
        tone: typeof body.tone === "string" ? body.tone : "friendly",
        behaviours: typeof body.behaviours === "string" ? body.behaviours : "",
        businessRules: typeof body.businessRules === "string" ? body.businessRules : "",
        escalationRules: typeof body.escalationRules === "string" ? body.escalationRules : "",
      },
      {
        businessProfile: {
          businessName: business.business_name,
          trade: business.trade,
          description: business.business_description,
          services: business.services ?? [],
          serviceAreas: business.service_areas ?? [],
          openingTime: business.opening_time,
          closingTime: business.closing_time,
          offersEmergencyCallouts: business.offers_emergency_callouts,
          chargesCalloutFee: business.charges_callout_fee,
          calloutFeeAmount: business.callout_fee_amount,
          receptionistName: business.receptionist_name,
          knowledge: parseKnowledge(business.business_knowledge),
        },
        diary: {
          availability,
          todaysAvailabilityReply: describeBookingReply(availability, now),
          nextAvailable: nextAvailableSlot(availability, now),
        },
        faqs: Array.isArray(config?.faqs) ? config.faqs : [],
      },
      { priorState, recentHistory }
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error("[live-reply] generation failed:", err);
    return NextResponse.json({ error: "Could not generate a live reply right now." }, { status: 500 });
  }
}
