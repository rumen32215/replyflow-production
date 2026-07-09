import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MessageCircle, Building2, Brain } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Welcome — ReplyFlow" };

// Checks the caller's session server-side — must not be statically
// prerendered (see app/page.tsx for the full explanation).
export const dynamic = "force-dynamic";

const PREVIEW = [
  { icon: MessageCircle, title: "Connect WhatsApp", desc: "Link your existing WhatsApp Business number" },
  { icon: Building2, title: "Tell us about your business", desc: "Name, trade, hours and coverage area" },
  { icon: Brain, title: "Train your AI", desc: "A few plain-English questions, that's it" },
];

export default async function WelcomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AuthCard>
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-success/10 text-2xl">
        👋
      </div>
      <h1 className="mb-2 text-[25px] font-extrabold tracking-tight">Welcome to ReplyFlow.</h1>
      <p className="mb-7 text-[14.5px] text-muted-foreground">Let&apos;s get you ready in under 2 minutes.</p>

      <ul className="mb-8 divide-y divide-border">
        {PREVIEW.map((item, i) => (
          <li key={item.title} className="flex items-center gap-3.5 py-3.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] font-bold text-muted-foreground">
              {i + 1}
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-border bg-background text-muted-foreground">
              <item.icon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold">{item.title}</span>
              <span className="block text-xs text-muted-foreground">{item.desc}</span>
            </span>
          </li>
        ))}
      </ul>

      <Link href="/onboarding/business-info">
        <Button variant="default" className="w-full">
          Let&apos;s go
        </Button>
      </Link>
    </AuthCard>
  );
}
