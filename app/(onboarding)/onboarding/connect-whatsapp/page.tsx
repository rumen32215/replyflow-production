import type { Metadata } from "next";
import { WhatsAppEmbeddedSignup } from "@/components/dashboard/whatsapp-embedded-signup";

export const metadata: Metadata = { title: "Connect WhatsApp — ReplyFlow" };

/**
 * Screen 3 of onboarding — the real Meta Embedded Signup, not the old
 * simulated placeholder. Same component the dashboard's WhatsApp page
 * uses (see components/dashboard/whatsapp-embedded-signup.tsx); only
 * difference here is redirectTo, which sends the user straight to the
 * dashboard on success instead of refreshing in place.
 */
export default function ConnectWhatsAppPage() {
  return (
    <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-elevated sm:p-10">
      <h1 className="mb-2 text-[22px] font-extrabold tracking-tight">Connect WhatsApp</h1>
      <p className="mb-7 text-[14.5px] leading-relaxed text-muted-foreground">
        Link your WhatsApp Business number so ReplyFlow can start answering for real.
      </p>
      <WhatsAppEmbeddedSignup redirectTo="/dashboard" />
    </div>
  );
}
