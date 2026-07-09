import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessagesSquare, Bot, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/stat-card";
import { ActivationHero } from "@/components/dashboard/activation-hero";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableHeader, TableRow, TableHead, TableBody } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Dashboard — ReplyFlow" };

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("business_name, whatsapp_connected")
    .eq("owner_id", user.id)
    .maybeSingle();

  const businessName = business?.business_name ?? "there";
  // Onboarding's WhatsApp step is currently a simulation (see
  // components/onboarding/step-connect-whatsapp.tsx) — this flag is
  // real data, but "connected" doesn't yet mean a live Meta webhook.
  const whatsappConnected = business?.whatsapp_connected ?? false;

  // Placeholder until AI Conversations (Phase 5) exists — no
  // conversations table to count yet, so this is hardcoded, not faked
  // as if it were live. Everything below reacts to this being zero.
  const todaysEnquiries = 0;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-[26px] font-extrabold tracking-tight">Good morning, {businessName} 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {todaysEnquiries === 0 && <ActivationHero whatsappConnected={whatsappConnected} />}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={MessagesSquare} label="Today's Enquiries" value="0" />
        <StatCard icon={Bot} label="AI Handled" value="0" tone="success" />
        <StatCard icon={UserCheck} label="Human Replies" value="0" />
      </div>

      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-[15px] font-bold">Recent Enquiries</h2>
          <Badge variant="outline">Live once WhatsApp is connected</Badge>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Enquiry</TableHead>
              <TableHead>Handled by</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody />
        </Table>

        <EmptyState
          className="border-none"
          icon={MessagesSquare}
          title="No enquiries yet"
          description="They'll appear here the moment your AI receptionist starts qualifying them."
        />
      </div>
    </div>
  );
}
