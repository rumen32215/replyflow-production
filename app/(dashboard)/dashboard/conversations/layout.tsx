import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConversationsShell } from "@/components/dashboard/conversations/conversations-shell";
import { parseKnowledge, understandingScore } from "@/lib/knowledge";

export default async function ConversationsLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, business_description, services, service_areas, business_knowledge")
    .eq("owner_id", user.id)
    .maybeSingle();

  const [{ data: conversations }, { data: config }] = business
    ? await Promise.all([
        supabase
          .from("conversations")
          .select("id, customer_name, customer_phone, last_message_preview, last_message_at, status")
          .eq("business_id", business.id)
          .order("last_message_at", { ascending: false, nullsFirst: false }),
        supabase.from("ai_configurations").select("faqs").eq("business_id", business.id).maybeSingle(),
      ])
    : [{ data: [] }, { data: null }];

  // Reused for the quiet-moment nudge below — same gap Front Desk and
  // Business Knowledge's own score already surface, never invented.
  const topGap = business
    ? (understandingScore({
        businessDescription: business.business_description,
        services: business.services ?? [],
        serviceAreas: business.service_areas ?? [],
        knowledge: parseKnowledge(business.business_knowledge),
        faqCount: Array.isArray(config?.faqs) ? (config.faqs as unknown[]).length : 0,
      }).missing[0] ?? null)
    : null;

  return (
    <ConversationsShell conversations={conversations ?? []} topGap={topGap}>
      {children}
    </ConversationsShell>
  );
}
