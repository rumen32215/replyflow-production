import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Zap, Camera, TrendingUp } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Welcome — ReplyFlow" };

// Checks the caller's session server-side — must not be statically
// prerendered (see app/page.tsx for the full explanation).
export const dynamic = "force-dynamic";

const BENEFITS = [
  { icon: Zap, label: "Replies instantly" },
  { icon: Camera, label: "Collects photos" },
  { icon: TrendingUp, label: "Helps you win more jobs" },
];

/**
 * Onboarding Screen 1 — "hiring" moment, not a form. No inputs on this
 * screen at all; business details moved to guided setup tasks inside
 * the dashboard (see the onboarding redesign brief). This is still the
 * same /welcome route used as the auth->onboarding bridge — only the
 * content and destination changed.
 */
export default async function WelcomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AuthCard className="text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-success shadow-elevated">
        <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8">
          <path d="M4 20l1.6-4.8A8 8 0 1112 20a7.96 7.96 0 01-3.9-1L4 20z" fill="white" />
        </svg>
      </div>

      <h1 className="mb-2.5 text-[26px] font-extrabold leading-tight tracking-tight">
        Meet your new AI receptionist.
      </h1>
      <p className="mb-8 text-[15px] leading-relaxed text-muted-foreground">
        ReplyFlow answers customers while you&apos;re busy.
      </p>

      <ul className="mb-8 flex flex-col gap-3">
        {BENEFITS.map((benefit) => (
          <li
            key={benefit.label}
            className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3.5 text-left"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
              <benefit.icon className="h-4 w-4" />
            </span>
            <span className="text-[14.5px] font-semibold">{benefit.label}</span>
          </li>
        ))}
      </ul>

      <Link href="/onboarding/demo">
        <Button variant="primary" size="lg" className="w-full">
          Hire ReplyFlow
        </Button>
      </Link>
    </AuthCard>
  );
}
