import { Mail } from "lucide-react";
import { ResendEmailButton } from "@/components/auth/resend-email-button";

/**
 * V10 founder review (2026-08-04): the deferred-verification gate —
 * see `lib/auth/email-verification.ts` for why this exists and where
 * the decision of *when* to check lives. This component only ever
 * renders the "please verify first" state; callers are responsible
 * for deciding when to show it (`isEmailVerified(user)`) and never
 * render it once that's true, so there's nothing here that needs to
 * know about onboarding, WhatsApp, or any other specific gate.
 */
export function VerifyEmailGate({ email }: { email: string }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Mail className="h-5 w-5" />
      </div>
      <h2 className="text-[18px] font-bold">Verify your email first</h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
        Before I start watching a real number for customer messages, let&apos;s confirm it&apos;s really you — check{" "}
        <span className="font-semibold text-foreground">{email}</span> for the link we sent when you signed up.
      </p>
      <div className="mt-4">
        <ResendEmailButton email={email} />
      </div>
    </div>
  );
}
