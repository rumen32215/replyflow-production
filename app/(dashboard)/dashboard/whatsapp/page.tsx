import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { WhatsAppEmbeddedSignup } from "@/components/dashboard/whatsapp-embedded-signup";
import { Badge } from "@/components/ui/badge";
import { SettleCard } from "@/components/shared/motion";
import { VerifyEmailGate } from "@/components/shared/verify-email-gate";
import { isEmailVerified } from "@/lib/auth/email-verification";
import { TEST_CONVERSATION_PHONE } from "@/lib/test-conversation";

export const metadata: Metadata = { title: "Connect WhatsApp — ReplyFlow" };

export default async function WhatsAppConnectionPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).maybeSingle();

  const { data: connection } = business
    ? await supabase
        .from("whatsapp_connections")
        .select("display_phone_number, waba_id, connected_at")
        .eq("business_id", business.id)
        .maybeSingle()
    : { data: null };

  // RC2-M1 (Proof Before Ask, Principle 6), re-pointed for the V1
  // First-Run redesign: Meet now happens right after the one-minute
  // setup — thin, early, no longer a meaningful proof signal on its
  // own. The real proof gate moves to Test: has a genuine Test
  // Conversations exchange actually happened (at least one real
  // reply_drafts row against the reserved test conversation — never
  // written for the honest "not ready" fallback, only for a real,
  // generated reply). Only guards the *unconnected* path: a business
  // that's already connected must always be able to revisit its own
  // connection status here, regardless of how it got there.
  let hasRealTestExchange = false;
  if (business && !connection) {
    const { data: testConversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("business_id", business.id)
      .eq("customer_phone", TEST_CONVERSATION_PHONE)
      .maybeSingle();
    if (testConversation) {
      const { count } = await supabase
        .from("reply_drafts")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", testConversation.id);
      hasRealTestExchange = Boolean(count && count > 0);
    }
  }

  if (!connection && !hasRealTestExchange) {
    redirect("/dashboard");
  }

  // V10 founder review (2026-08-04): sign-up now grants access to
  // onboarding (and the Test Conversations sandbox above) before
  // email verification — deliberately, to preserve momentum. This is
  // the actual gate that decision deferred to: the moment a business
  // is about to start watching a *real* WhatsApp number for *real*
  // customer messages. Same "only guards the unconnected path"
  // philosophy as `hasRealTestExchange` above — a business that's
  // already connected must always be able to revisit its own
  // connection status here, regardless of how it got there.
  if (!connection && !isEmailVerified(user)) {
    return (
      <div className="mx-auto max-w-2xl">
        <SettleCard className="mb-8">
          <h1 className="text-[26px] font-extrabold tracking-tight">Connect WhatsApp</h1>
          <p className="mt-1 text-sm text-muted-foreground">One more thing before this goes live.</p>
        </SettleCard>
        <SettleCard delay={0.05}>
          <VerifyEmailGate email={user.email!} />
        </SettleCard>
      </div>
    );
  }

  // Only a genuinely unconfigured environment needs to see this — a
  // real merchant on a properly set-up account never should (this was
  // leaking raw env-var names and webhook paths to every user before).
  const missingConfig = !process.env.NEXT_PUBLIC_WHATSAPP_APP_ID || !process.env.NEXT_PUBLIC_WHATSAPP_CONFIG_ID;

  return (
    <div className="mx-auto max-w-2xl">
      <SettleCard className="mb-8">
        <h1 className="text-[26px] font-extrabold tracking-tight">Connect WhatsApp</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {connection
            ? "This is the number I answer on."
            : "Once this is connected, I'll start watching for real customer messages."}
        </p>
      </SettleCard>

      {connection ? (
        <SettleCard delay={0.05} className="rounded-2xl border border-success/20 bg-success/5 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success text-white">
            <CheckCircle2 className="h-6 w-6" strokeWidth={2.5} />
          </div>
          <p className="mb-1 text-[16px] font-bold">{connection.display_phone_number}</p>
          <p className="mb-4 text-[13px] text-muted-foreground">
            Connected since {new Date(connection.connected_at).toLocaleDateString("en-GB", { dateStyle: "long" })}
          </p>
          <Badge variant="success">
            <CheckCircle2 className="h-3 w-3" /> I&apos;m watching this number for messages
          </Badge>
        </SettleCard>
      ) : (
        <>
          <SettleCard delay={0.05}>
            <WhatsAppEmbeddedSignup />
          </SettleCard>
          {missingConfig && (
            <SettleCard
              delay={0.1}
              className="mt-5 flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 px-4 py-3.5"
            >
              <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                This environment isn&apos;t configured for WhatsApp yet — it needs a Meta App with Embedded Signup set up (
                <code className="rounded bg-border/60 px-1 py-0.5 text-[11.5px]">NEXT_PUBLIC_WHATSAPP_APP_ID</code> and{" "}
                <code className="rounded bg-border/60 px-1 py-0.5 text-[11.5px]">NEXT_PUBLIC_WHATSAPP_CONFIG_ID</code>)
                and a webhook pointing at{" "}
                <code className="rounded bg-border/60 px-1 py-0.5 text-[11.5px]">/api/webhooks/whatsapp</code>. This
                note only shows up while that&apos;s missing — real accounts never see it.
              </p>
            </SettleCard>
          )}
        </>
      )}
    </div>
  );
}
