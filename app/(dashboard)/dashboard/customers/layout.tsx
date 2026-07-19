import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CustomersShell } from "@/components/dashboard/customers/customers-shell";
import { relationshipStrengthFor } from "@/lib/customer-memory-signals";
import { minutesSince, formatWaitingTime } from "@/lib/dashboard-signals";
import type { CustomerListItem } from "@/components/dashboard/customers/customer-list";

/**
 * Customer Memory (Sprint 7) — there is no dedicated "customers"
 * table; a customer is a real `conversations` row (unique per
 * business_id + customer_phone — see supabase/migrations/0003), and
 * their history is their real `jobs` rows. This layout fetches both
 * once and shapes them into the list every child route shares,
 * exactly the pattern app/(dashboard)/dashboard/conversations/layout.tsx
 * already uses.
 */
export default async function CustomersLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (businessError) throw new Error(`Failed to load business: ${businessError.message}`);
  if (!business) redirect("/welcome");

  const [{ data: conversations }, { data: jobs }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, customer_name, customer_phone, status, last_message_at")
      .eq("business_id", business.id)
      .order("last_message_at", { ascending: false, nullsFirst: false }),
    supabase.from("jobs").select("conversation_id, status").eq("business_id", business.id),
  ]);

  const completedCountByConversation = new Map<string, number>();
  for (const job of jobs ?? []) {
    if (job.status === "completed" && job.conversation_id) {
      completedCountByConversation.set(
        job.conversation_id,
        (completedCountByConversation.get(job.conversation_id) ?? 0) + 1
      );
    }
  }

  const customers: CustomerListItem[] = (conversations ?? []).map((c) => {
    const completedJobCount = completedCountByConversation.get(c.id) ?? 0;
    return {
      id: c.id,
      name: c.customer_name || c.customer_phone,
      phone: c.customer_phone,
      status: c.status,
      // Computed once, here, server-side — see customer-list.tsx's
      // CustomerListItem doc comment for why this must never be
      // recomputed from a raw timestamp inside the Client Component.
      lastActivityLabel: c.last_message_at ? `${formatWaitingTime(minutesSince(c.last_message_at))} ago` : null,
      completedJobCount,
      strength: relationshipStrengthFor(completedJobCount),
    };
  });

  return <CustomersShell customers={customers}>{children}</CustomersShell>;
}
