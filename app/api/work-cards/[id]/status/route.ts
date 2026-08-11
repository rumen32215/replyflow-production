import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordErrorEvent } from "@/lib/error-events";
import { closeEpisode } from "@/lib/reply-engine/episode";

export const runtime = "nodejs";

const VALID_STATUSES = ["in_progress", "completed", "cancelled"] as const;
type Status = (typeof VALID_STATUSES)[number];

/**
 * ReplyFlow V4 — Conversation Episodes. Every Work Card status
 * transition that closes or advances a job now also has to update its
 * episode, and conversation_episodes is service-role-write-only (same
 * boundary as reply_drafts/conversation_photos) — a client component
 * can no longer make this transition with a direct Supabase call. This
 * is the one canonical route both work-card-detail.tsx's transitionTo
 * and conversation-story.tsx's rejectJob now call, replacing two
 * separate direct-write implementations with one.
 *
 * Booking ("approve") is deliberately not handled here — that's a real
 * customer-facing send, already its own route
 * (app/api/work-cards/[id]/approve/route.ts), which now also marks the
 * episode 'booked' directly.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!VALID_STATUSES.includes(body.status as Status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  const nextStatus = body.status as Status;

  const service = createServiceClient();

  const { data: workCard } = await service
    .from("work_cards")
    .select("id, business_id, episode_id, status")
    .eq("id", params.id)
    .maybeSingle();
  if (!workCard) return NextResponse.json({ error: "Work Card not found" }, { status: 404 });

  const { data: business } = await service.from("businesses").select("owner_id").eq("id", workCard.business_id).maybeSingle();
  if (!business || business.owner_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const updates: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === "completed") updates.completed_at = new Date().toISOString();

  const { error: updateError } = await service.from("work_cards").update(updates).eq("id", workCard.id);
  if (updateError) {
    await recordErrorEvent({
      severity: "error",
      source: "work-cards.status_transition_failed",
      businessId: workCard.business_id,
      message: `Failed to move a Work Card to status "${nextStatus}".`,
      error: updateError,
      context: { workCardId: workCard.id },
    });
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Deterministic episode closure (Contract §B) — no model involved.
  // completed -> completed, cancelled -> abandoned. in_progress isn't
  // a closing transition, so the episode is left exactly as it is.
  if (workCard.episode_id && (nextStatus === "completed" || nextStatus === "cancelled")) {
    await closeEpisode(service, workCard.episode_id, nextStatus === "completed" ? "completed" : "abandoned");
  }

  return NextResponse.json({ status: nextStatus, completedAt: nextStatus === "completed" ? (updates.completed_at as string) : null });
}
