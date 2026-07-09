import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConversationsShell } from "@/components/dashboard/conversations/conversations-shell";

export default async function ConversationsLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).maybeSingle();

  const { data: conversations } = business
    ? await supabase
        .from("conversations")
        .select("id, customer_name, customer_phone, last_message_preview, last_message_at, status")
        .eq("business_id", business.id)
        .order("last_message_at", { ascending: false, nullsFirst: false })
    : { data: [] };

  return <ConversationsShell conversations={conversations ?? []}>{children}</ConversationsShell>;
}
