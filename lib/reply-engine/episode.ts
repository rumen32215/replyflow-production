import "server-only";
import type { createServiceClient } from "@/lib/supabase/service";
import { EMPTY_CONVERSATION_STATE, toConversationState, type ConversationState } from "./understanding/state";

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * ReplyFlow V4 — Conversation Episodes (Implementation Contract, §B).
 * The real, database-level boundary between one job/enquiry and the
 * next, for the same permanent customer. Root cause this closes: a
 * customer's `conversations` row is permanent (one per phone number,
 * forever) — everything that used to key off it directly (ai_state,
 * messages, photos, drafts) silently accumulated every job a customer
 * ever had into one undifferentiated blob. This file is the one place
 * that decides which episode a given moment belongs to.
 *
 * Only 'active'/'waiting_owner' count as "in progress" for the
 * one-episode-at-a-time guarantee (0031's partial unique index) — a
 * 'booked' episode (a confirmed future appointment) does not block a
 * new, unrelated episode from opening.
 */

const IN_PROGRESS_STATUSES = ["active", "waiting_owner"] as const;

/**
 * Product Reset Blueprint D.1 — the continuity fix. A `booked` episode
 * is deliberately excluded from "in progress" above (a confirmed
 * future appointment shouldn't block a genuinely new, unrelated
 * problem from opening its own episode) — but that same exclusion
 * meant ANY message after booking, including more photos of the exact
 * same job, was routed into a brand-new, context-free episode with the
 * classifier never even consulted (traced live: a booked kitchen-sink
 * leak, followed minutes later by photos of that same leak, opened a
 * fresh episode and misclassified the photos as a new EMERGENCY).
 *
 * This constant bounds how long a booked episode stays eligible to be
 * offered as a continuity candidate: always eligible while its
 * appointment is still upcoming (no matter how far out), and for this
 * many hours after the scheduled time has passed — long enough for a
 * same-day or next-day follow-up, short enough that a customer
 * messaging again days or weeks later gets a fresh episode rather than
 * reopening old history. This boundary is deterministic, not a model
 * judgment — the classifier is never trusted with deciding whether a
 * two-week-old job should be reopened.
 */
const BOOKED_CONTINUITY_GRACE_HOURS = 48;

export interface EpisodeRow {
  id: string;
  status: "active" | "waiting_owner" | "booked" | "completed" | "abandoned";
  ai_state: unknown;
}

/** The customer's one, unambiguous in-progress episode, if any. Relies
 * on 0031's partial unique index to guarantee there's never more than
 * one — this is a plain lookup, never a guess. */
export async function findInProgressEpisode(supabase: ServiceClient, conversationId: string): Promise<EpisodeRow | null> {
  const { data } = await supabase
    .from("conversation_episodes")
    .select("id, status, ai_state")
    .eq("conversation_id", conversationId)
    .in("status", IN_PROGRESS_STATUSES)
    .maybeSingle();
  return (data as EpisodeRow | null) ?? null;
}

/**
 * The customer's most recently booked episode, only if it's still
 * genuinely "live" — see BOOKED_CONTINUITY_GRACE_HOURS above. Looks up
 * the episode's own linked Work Card for the real appointment time
 * (episodes don't store a schedule themselves; work_cards.episode_id
 * already exists for exactly this relationship). An episode with no
 * linked Work Card, or a Work Card with no scheduled_for, has nothing
 * to anchor "still upcoming" to — deliberately not offered as a
 * candidate rather than guessing.
 */
export async function findRecentlyBookedEpisode(
  supabase: ServiceClient,
  conversationId: string,
  now: Date = new Date()
): Promise<EpisodeRow | null> {
  const { data: episode } = await supabase
    .from("conversation_episodes")
    .select("id, status, ai_state")
    .eq("conversation_id", conversationId)
    .eq("status", "booked")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!episode) return null;

  const { data: workCard } = await supabase
    .from("work_cards")
    .select("scheduled_for")
    .eq("episode_id", episode.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!workCard?.scheduled_for) return null;

  const scheduledMs = new Date(workCard.scheduled_for).getTime();
  const graceMs = BOOKED_CONTINUITY_GRACE_HOURS * 60 * 60 * 1000;
  const stillLive = scheduledMs + graceMs >= now.getTime();
  return stillLive ? (episode as EpisodeRow) : null;
}

/**
 * Creates a new episode, always starting from EMPTY_CONVERSATION_STATE
 * — a new job must never inherit a previous one's slots, goal, or
 * commitments (Contract §G). Concurrency-safe: if two inbound messages
 * race to create the customer's first episode at once, 0031's partial
 * unique index rejects the loser here (Postgres 23505) — caught and
 * turned into "use the one the other request just created," the same
 * idempotent-retry shape reply_drafts' upsert-on-conflict already uses
 * elsewhere in this codebase, rather than a hard failure that would
 * drop the message.
 */
export async function createEpisode(
  supabase: ServiceClient,
  input: { conversationId: string; businessId: string }
): Promise<EpisodeRow> {
  const { data, error } = await supabase
    .from("conversation_episodes")
    .insert({
      conversation_id: input.conversationId,
      business_id: input.businessId,
      status: "active",
      ai_state: EMPTY_CONVERSATION_STATE,
    })
    .select("id, status, ai_state")
    .single();

  if (!error && data) return data as EpisodeRow;

  if (error?.code === "23505") {
    const existing = await findInProgressEpisode(supabase, input.conversationId);
    if (existing) return existing;
  }

  throw new Error(`Failed to create conversation episode: ${error?.message ?? "unknown error"}`);
}

/**
 * Deterministic closure — never asks the model (Contract §B: "no model
 * involved"). 'completed' when a Work Card is marked done, 'abandoned'
 * when one is cancelled/rejected or a new, unrelated job supersedes an
 * incomplete one. Also supersedes any reply draft still pending on
 * this episode (Contract §H) — nothing is ever left dangling as
 * "pending" on a closed episode, where it could otherwise resurface.
 */
export async function closeEpisode(
  supabase: ServiceClient,
  episodeId: string,
  status: "completed" | "abandoned"
): Promise<void> {
  await supabase
    .from("conversation_episodes")
    .update({ status, closed_at: new Date().toISOString() })
    .eq("id", episodeId);

  await supabase.from("reply_drafts").update({ status: "superseded" }).eq("episode_id", episodeId).eq("status", "pending");
}

/** Booking is not a closure — a booked episode is still a real, valid
 * future job, not "over" (Contract §A: booked doesn't block a new
 * episode, but it also isn't abandoned or completed). No closed_at, no
 * draft supersession — this only moves it out of the "in progress"
 * set so a genuinely new, unrelated request can open its own episode
 * alongside it. */
export async function markEpisodeBooked(supabase: ServiceClient, episodeId: string): Promise<void> {
  await supabase.from("conversation_episodes").update({ status: "booked" }).eq("id", episodeId);
}

export async function updateEpisodeState(supabase: ServiceClient, episodeId: string, state: ConversationState): Promise<void> {
  await supabase.from("conversation_episodes").update({ ai_state: state }).eq("id", episodeId);
}

export interface ResolvedEpisode {
  id: string;
  priorState: ConversationState;
  /** True when this call itself just created the episode — the caller
   * already knows there's nothing to check continuity against, so it
   * can skip asking the classifier about episode_continuity entirely
   * (Contract §B: "If PREVIOUS STATE is empty... the application does
   * not use this field in that case"). */
  isNew: boolean;
  /** Product Reset Blueprint D.1 — true when this episode was offered
   * as a continuity candidate because it's a recently booked job, not
   * because it's strictly "in progress". The caller must never treat a
   * "new_job" verdict against a candidate like this as a reason to
   * abandon it — a booked episode superseded by an unrelated new
   * request is still a real, valid future appointment and must be left
   * exactly as "booked". Only a genuinely in-progress episode gets
   * marked abandoned when superseded. */
  wasBookedCandidate: boolean;
}

/** The one entry point generate-reply.ts calls at the start of every
 * message: find the customer's in-progress episode, or a still-live
 * recently-booked one to check continuity against, or create a new one
 * if neither exists (Contract §B rule 1, extended by Blueprint D.1). */
export async function resolveEpisodeForMessage(
  supabase: ServiceClient,
  input: { conversationId: string; businessId: string },
  now: Date = new Date()
): Promise<ResolvedEpisode> {
  const inProgress = await findInProgressEpisode(supabase, input.conversationId);
  if (inProgress) {
    return { id: inProgress.id, priorState: toConversationState(inProgress.ai_state), isNew: false, wasBookedCandidate: false };
  }

  const recentlyBooked = await findRecentlyBookedEpisode(supabase, input.conversationId, now);
  if (recentlyBooked) {
    return { id: recentlyBooked.id, priorState: toConversationState(recentlyBooked.ai_state), isNew: false, wasBookedCandidate: true };
  }

  const created = await createEpisode(supabase, input);
  return { id: created.id, priorState: EMPTY_CONVERSATION_STATE, isNew: true, wasBookedCandidate: false };
}
