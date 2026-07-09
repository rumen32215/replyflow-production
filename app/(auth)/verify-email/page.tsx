import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { ResendEmailButton } from "@/components/auth/resend-email-button";

export const metadata: Metadata = { title: "Verify your email — ReplyFlow" };

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  const email = searchParams.email ?? "your inbox";

  return (
    <AuthCard>
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-primary">
          <MailCheck className="h-6 w-6" />
        </div>
        <h1 className="mb-2 text-[22px] font-extrabold tracking-tight">Verify your email</h1>
        <p className="mb-1 text-[14.5px] text-muted-foreground">We&apos;ve sent a verification link to</p>
        <p className="mb-7 text-[14.5px] font-semibold">{email}</p>
        <p className="mb-6 text-[13px] text-muted-foreground">
          Click the link in that email to activate your account. You can close this tab.
        </p>
        <p className="text-[13px] text-muted-foreground">
          Didn&apos;t get it? <ResendEmailButton email={searchParams.email ?? ""} />
        </p>
      </div>
    </AuthCard>
  );
}
