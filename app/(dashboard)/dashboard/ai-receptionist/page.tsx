import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AiReceptionistForm } from "@/components/dashboard/ai-receptionist-form";
import type { AiConfigurationInput } from "@/lib/validations/ai-configuration";

export const metadata: Metadata = { title: "AI Receptionist — ReplyFlow" };

export default async function AiReceptionistPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

 const { data: business } = await supabase
  .from("businesses")
  .select("id")
  .eq("owner_id", user.id)
  .maybeSingle();

if (!business) {
  redirect("/welcome");
}

  // No row yet is the normal first-visit state (ai_configurations is
  // only created once someone saves here) — fall back to sensible
  // defaults rather than treating it as an error.
  const { data: config } = await supabase
    .from("ai_configurations")
    .select("tone, system_prompt, business_rules, escalation_rules, faqs")
    .eq("business_id", business.id)
    .maybeSingle();

  const defaultValues: AiConfigurationInput = {
    tone: (config?.tone as AiConfigurationInput["tone"]) ?? "friendly",
    systemPrompt: config?.system_prompt ?? "",
    businessRules: config?.business_rules ?? "",
    escalationRules: config?.escalation_rules ?? "",
    faqs: config?.faqs ?? [],
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-[26px] font-extrabold tracking-tight">AI Receptionist</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          How ReplyFlow talks to your customers — tone, rules, and answers it already knows.
        </p>
      </div>

      <AiReceptionistForm businessId={business.id} defaultValues={defaultValues} />
    </div>
  );
}
