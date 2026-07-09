import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { WhatsAppEmbeddedSignup } from "@/components/dashboard/whatsapp-embedded-signup";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "WhatsApp Connection — ReplyFlow" };

export default async function WhatsAppConnectionPage() {
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

  const { data: connection } = business
    ? await supabase
        .from("whatsapp_connections")
        .select("display_phone_number, waba_id, connected_at")
        .eq("business_id", business.id)
        .maybeSingle()
    : { data: null };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-[26px] font-extrabold tracking-tight">WhatsApp Connection</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the WhatsApp Business number connected to ReplyFlow.
        </p>
      </div>

      {connection ? (
        <div className="rounded-2xl border border-success/20 bg-success/5 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success text-white">
            <CheckCircle2 className="h-6 w-6" strokeWidth={2.5} />
          </div>
          <p className="mb-1 text-[16px] font-bold">{connection.display_phone_number}</p>
          <p className="mb-4 text-[13px] text-muted-foreground">
            Connected {new Date(connection.connected_at).toLocaleDateString("en-GB", { dateStyle: "long" })}
          </p>
          <Badge variant="success">
            <CheckCircle2 className="h-3 w-3" /> Receiving live messages
          </Badge>
        </div>
      ) : (
        <>
          <WhatsAppEmbeddedSignup />
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 px-4 py-3.5">
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              Requires a Meta App with WhatsApp Embedded Signup configured (
              <code className="rounded bg-border/60 px-1 py-0.5 text-[11.5px]">NEXT_PUBLIC_WHATSAPP_APP_ID</code> and{" "}
              <code className="rounded bg-border/60 px-1 py-0.5 text-[11.5px]">NEXT_PUBLIC_WHATSAPP_CONFIG_ID</code>{" "}
              in your environment) and a webhook URL registered in Meta&apos;s dashboard pointing at{" "}
              <code className="rounded bg-border/60 px-1 py-0.5 text-[11.5px]">/api/webhooks/whatsapp</code>.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
