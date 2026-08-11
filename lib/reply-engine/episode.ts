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
}

/** The one entry point generate-reply.ts calls at the start of every
 * message: find the customer's in-progress episode, or create one if
 * there isn't one (Contract §B, rule 1 — deterministic, no model
 * judgment needed when nothing is in progress at all). */
export async function resolveEpisodeForMessage(
  supabase: ServiceClient,
  input: { conversationId: string; businessId: string }
): Promise<ResolvedEpisode> {
  const inProgress = await findInProgressEpisode(supabase, input.conversationId);
  if (!inProgress) {
    const created = await createEpisode(supabase, input);
    return { id: created.id, priorState: EMPTY_CONVERSATION_STATE, isNew: true };
  }
  return { id: inProgress.id, priorState: toConversationState(inProgress.ai_state), isNew: false };
}
