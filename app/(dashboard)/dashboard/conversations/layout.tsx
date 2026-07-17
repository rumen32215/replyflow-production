import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConversationsShell } from "@/components/dashboard/conversations/conversations-shell";
import { parseKnowledge } from "@/lib/knowledge";
import { parseAvailability } from "@/lib/availability";
import { buildBrain } from "@/lib/intelligence";
import { groupForStatus } from "@/lib/conversations";
import { minutesSince } from "@/lib/dashboard-signals";

export default async function ConversationsLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select(
      "id, business_description, services, service_areas, business_knowledge, availability, opening_time, closing_time, whatsapp_connected"
    )
    .eq("owner_id", user.id)
    .maybeSingle();
  // A real query error is not "no business yet" — see the identical
  // fix and explanation in dashboard/receptionist/page.tsx.
  if (businessError) throw new Error(`Failed to load business: ${businessError.message}`);

  const [{ data: conversations }, { data: config }, { data: draftJobs }] = business
    ? await Promise.all([
        supabase
          .from("conversations")
          .select("id, customer_name, customer_phone, last_message_preview, last_message_at, status")
          .eq("business_id", business.id)
          .order("last_message_at", { ascending: false, nullsFirst: false }),
        supabase
          .from("ai_configurations")
          .select("faqs, system_prompt, business_rules, escalation_rules")
          .eq("business_id", business.id)
          .maybeSingle(),
        // Which conversations have a booking waiting on the owner's
        // decision — an orthogonal signal to conversation status, so
        // the list can surface it without a 5th status group.
        supabase.from("jobs").select("conversation_id").eq("business_id", business.id).eq("status", "draft"),
      ])
    : [{ data: [] }, { data: null }, { data: [] }];

  const draftConversationIds = (draftJobs ?? [])
    .map((j) => j.conversation_id)
    .filter((id): id is string => Boolean(id));

  // Oldest waiting conversation — real data, used both for the Brain's
  // `thoughts.watching` and (previously) the standalone topGap fetch
  // this layout used to compute independently of Front Desk's.
  const waiting = (conversations ?? [])
    .filter((c) => groupForStatus(c.status) === "waiting" && c.last_message_at)
    .sort((a, b) => new Date(a.last_message_at as string).getTime() - new Date(b.last_message_at as string).getTime());
  const oldestWaiting = waiting[0] ?? null;

  // Same shared Brain Front Desk uses (lib/intelligence.ts) — this
  // used to be a second, independent understandingScore() call; now
  // it's the same reasoning model, just fed this page's own fetch.
  const brain = business
    ? buildBrain({
        knowledge: {
          businessDescription: business.business_description,
          services: business.services ?? [],
          serviceAreas: business.service_areas ?? [],
          knowledge: parseKnowledge(business.business_knowledge),
          faqCount: Array.isArray(config?.faqs) ? (config.faqs as unknown[]).length : 0,
        },
        receptionist: {
          behavioursTaught: Boolean(config?.system_prompt?.trim()),
          rulesTaught: Boolean(config?.business_rules?.trim()),
          escalationTaught: Boolean(config?.escalation_rules?.trim()),
        },
        diary: {
          rules: parseAvailability(business.availability, business.opening_time, business.closing_time).rules,
        },
        activity: {
          whatsappConnected: business.whatsapp_connected ?? false,
          waitingCount: waiting.length,
          oldestWaitingName: oldestWaiting ? oldestWaiting.customer_name || oldestWaiting.customer_phone : null,
          oldestWaitingMinutes: oldestWaiting ? minutesSince(oldestWaiting.last_message_at as string) : null,
          completedToday: 0,
          bookedToday: 0,
        },
      })
    : null;

  return (
    <ConversationsShell
      conversations={conversations ?? []}
      topGap={brain?.gaps[0]?.label ?? null}
      learned={brain ? brain.thoughts.confidentAbout.slice(0, 3).map((t) => t.label) : []}
      draftConversationIds={draftConversationIds}
    >
      {children}
    </ConversationsShell>
  );
}
