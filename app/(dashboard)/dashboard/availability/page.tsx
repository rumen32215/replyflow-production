import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AvailabilityDiary } from "@/components/dashboard/availability/availability-diary";
import { parseAvailability } from "@/lib/availability";
import { groupForStatus } from "@/lib/conversations";
import { toConversationState } from "@/lib/reply-engine/understanding/state";
import type { TodaysWorkItem } from "@/components/dashboard/home/todays-work";

export const metadata: Metadata = { title: "Availability — ReplyFlow" };

/**
 * The receptionist's diary (Availability V1, Master Execution Plan
 * 2.2). The owner isn't managing a calendar — they're telling their
 * receptionist "these are the times I'm available." parseAvailability
 * merges whatever is stored (possibly {}) over sensible defaults, so
 * the diary always renders complete and pre-migration businesses keep
 * their original opening/closing times.
 *
 * 2.2 adds the real schedule alongside the existing rules — "Today:
 * Taking bookings" answers "am I open for new work," a genuinely
 * different question from "what's actually on today," which nothing
 * on this page answered before. Reuses the exact Work Card query
 * shape and TodaysWork component `dashboard/page.tsx` already built
 * for Front Desk, rather than inventing a second way to ask the same
 * question.
 */
export default async function AvailabilityPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, availability, opening_time, closing_time")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) redirect("/welcome");

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const endOfTomorrow = new Date(endOfToday);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

  const [{ data: todaysCards }, { data: tomorrowsCards }] = await Promise.all([
    supabase
      .from("work_cards")
      .select("id, conversation_id, customer_name, issue, status, scheduled_for, address_confirmed")
      .eq("business_id", business.id)
      .gte("scheduled_for", startOfToday.toISOString())
      .lt("scheduled_for", endOfToday.toISOString())
      .order("scheduled_for", { ascending: true }),
    supabase
      .from("work_cards")
      .select("id, conversation_id, customer_name, issue, status, scheduled_for, address_confirmed")
      .eq("business_id", business.id)
      .gte("scheduled_for", endOfToday.toISOString())
      .lt("scheduled_for", endOfTomorrow.toISOString())
      .order("scheduled_for", { ascending: true }),
  ]);

  const allCards = [...(todaysCards ?? []), ...(tomorrowsCards ?? [])];
  const conversationIds = Array.from(new Set(allCards.map((c) => c.conversation_id).filter((id): id is string => Boolean(id))));

  const { data: conversations } =
    conversationIds.length > 0
      ? await supabase.from("conversations").select("id, status, ai_state").in("id", conversationIds)
      : { data: [] };

  const conversationById = new Map(
    (conversations ?? []).map((c) => {
      const state = toConversationState(c.ai_state);
      return [
        c.id,
        {
          group: groupForStatus(c.status),
          isEmergency: state.goal.type === "handle_emergency" && state.goal.status !== "completed" && state.goal.status !== "abandoned",
        },
      ];
    })
  );

  function toWorkCardItems(cards: typeof allCards): TodaysWorkItem[] {
    return cards.map((c) => {
      const entry = c.conversation_id ? conversationById.get(c.conversation_id) : undefined;
      return {
        id: c.id,
        conversationId: c.conversation_id,
        customerName: c.customer_name,
        issue: c.issue,
        scheduledFor: c.scheduled_for,
        status: c.status,
        addressConfirmed: c.address_confirmed,
        conversationGroup: entry?.group ?? null,
        isEmergency: entry?.isEmergency ?? false,
      };
    });
  }

  return (
    <AvailabilityDiary
      businessId={business.id}
      initial={parseAvailability(business.availability, business.opening_time, business.closing_time)}
      todaysWork={toWorkCardItems(todaysCards ?? [])}
      tomorrowsWork={toWorkCardItems(tomorrowsCards ?? [])}
    />
  );
}
