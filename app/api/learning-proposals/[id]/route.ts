import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordProductEvent } from "@/lib/product-events";

export const runtime = "nodejs";

/**
 * Resolves one learning proposal — the four outcomes doc 12 §2.4
 * requires: confirm, ignore, clarify, or defer ("remind me later").
 * Same auth shape as reply-drafts' own resolution route: RLS only
 * grants owners SELECT on learning_proposals, so every write — most of
 * all a confirm, which also writes to ai_configurations — happens here
 * with the service role after an explicit ownership check.
 *
 * "Infer to propose, ask to confirm" (doc 12) is enforced structurally
 * here, not just in prompt wording: proposed_lesson is never written to
 * ai_configurations by anything in this codebase until this route sees
 * an explicit confirm/clarify action from the business's own owner.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { action?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { action } = body;
  if (action !== "confirm" && action !== "ignore" && action !== "clarify" && action !== "defer") {
    return NextResponse.json({ error: "action must be confirm, ignore, clarify, or defer" }, { status: 400 });
  }
  if (action === "clarify" && (typeof body.text !== "string" || !body.text.trim())) {
    return NextResponse.json({ error: "text is required to clarify a proposal" }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: proposal } = await service
    .from("learning_proposals")
    .select("id, business_id, proposed_lesson, status")
    .eq("id", params.id)
    .maybeSingle();
  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });

  const { data: business } = await service
    .from("businesses")
    .select("id, owner_id")
    .eq("id", proposal.business_id)
    .maybeSingle();
  if (!business || business.owner_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (proposal.status !== "pending" && proposal.status !== "deferred") {
    return NextResponse.json({ error: `This proposal is already ${proposal.status}.` }, { status: 409 });
  }

  if (action === "defer") {
    // "Remind me later" — a first-class, permanent way to postpone
    // (doc 12 §2.4). No resolved_at: it stays eligible to be selected
    // again on a future page load, deliberately without a session-based
    // cooldown for V1 (a stated simplification, not a silent gap).
    const { data: updated } = await service
      .from("learning_proposals")
      .update({ status: "deferred" })
      .eq("id", proposal.id)
      .select()
      .single();
    await recordProductEvent({ eventType: "learning.deferred", businessId: proposal.business_id, context: { proposalId: proposal.id } });
    return NextResponse.json({ proposal: updated });
  }

  if (action === "ignore") {
    const { data: updated } = await service
      .from("learning_proposals")
      .update({ status: "ignored", resolved_at: new Date().toISOString() })
      .eq("id", proposal.id)
      .select()
      .single();
    await recordProductEvent({ eventType: "learning.ignored", businessId: proposal.business_id, context: { proposalId: proposal.id } });
    return NextResponse.json({ proposal: updated });
  }

  // confirm or clarify — both write a real sentence into
  // ai_configurations.business_rules, the exact same field teaching
  // already writes to (doc 12 §2.5): confirm writes the AI's own
  // hedged guess (now confirmed true), clarify writes the owner's own
  // words instead, never the guess it replaced.
  const confirmedText = action === "clarify" ? body.text!.trim() : proposal.proposed_lesson;

  const { data: config } = await service
    .from("ai_configurations")
    .select("business_rules")
    .eq("business_id", proposal.business_id)
    .maybeSingle();
  const existingRules = config?.business_rules ?? "";
  const nextRules = [existingRules.trim(), confirmedText].filter(Boolean).join("\n");

  const { error: rulesError } = await service
    .from("ai_configurations")
    .upsert({ business_id: proposal.business_id, business_rules: nextRules }, { onConflict: "business_id" });
  if (rulesError) {
    return NextResponse.json({ error: "Could not save this to your receptionist's rules." }, { status: 500 });
  }

  const { data: updated } = await service
    .from("learning_proposals")
    .update({ status: action, confirmed_text: confirmedText, resolved_at: new Date().toISOString() })
    .eq("id", proposal.id)
    .select()
    .single();
  await recordProductEvent({
    eventType: action === "clarify" ? "learning.clarified" : "learning.confirmed",
    businessId: proposal.business_id,
    context: { proposalId: proposal.id },
  });

  return NextResponse.json({ proposal: updated });
}
