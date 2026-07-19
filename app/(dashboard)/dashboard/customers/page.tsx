import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sparkles, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Customers — ReplyFlow" };

/**
 * Rendered as the right pane's content only on desktop (the shell
 * hides this route entirely on mobile in favour of the list — see
 * components/dashboard/customers/customers-shell.tsx). Same "pick
 * something" pattern as app/(dashboard)/dashboard/conversations/page.tsx.
 *
 * Sprint 7.6: "Choose someone from the list" made no sense when the
 * list is empty — a real inconsistency next to the list panel's own
 * honest "No customers yet" teaser right beside it. This does its own
 * light count query (the same page-level Server Component pattern
 * used throughout the app) purely to pick the right sentence — it
 * fetches no customer data and shows no fabricated content either way.
 */
export default async function CustomersIndexPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).maybeSingle();
  if (!business) redirect("/welcome");

  const { count } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id);
  const hasCustomers = (count ?? 0) > 0;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {hasCustomers ? <Users className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </div>
      {hasCustomers ? (
        <div>
          <p className="text-[14px] font-semibold">Select a customer</p>
          <p className="mt-1 text-[13px] text-muted-foreground">Choose someone from the list to see what I remember.</p>
        </div>
      ) : (
        <div>
          <p className="text-[14px] font-semibold">I&apos;ll be ready the moment they are.</p>
          <p className="mt-1 max-w-[220px] text-[13px] text-muted-foreground">
            As soon as your first customer gets in touch, their details will open here.
          </p>
        </div>
      )}
    </div>
  );
}
