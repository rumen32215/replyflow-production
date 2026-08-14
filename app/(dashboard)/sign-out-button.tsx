"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";

export function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const resetOnboarding = useOnboardingStore((s) => s.reset);

  async function signOut() {
    setLoading(true);
    await supabase.auth.signOut();
    // Production hardening (2026-08-14) — two localStorage keys
    // (onboarding wizard draft, the "office ready" celebration flag)
    // were never scoped by user id and never cleared here, so a second
    // account signing in on the same device could silently inherit
    // state left behind by the first. Neither drives auth itself (the
    // real session lives in cookies, cleared by signOut() above), but
    // clearing them on the one deterministic "this session is over"
    // moment closes the gap rather than leaving stale local state to
    // resurface confusingly for the next account.
    resetOnboarding();
    window.localStorage.removeItem("replyflow:office-ready-celebrated");
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
      {/* Product cleanup pass (2026-08-14) — mobile topbar overflow fix:
       * this text, unconditionally shown at every width, was one of the
       * contributors to the mobile secondary nav overflowing its row
       * (6 icons + avatar + this button, no wrap, no scroll). Same
       * hidden-until-sm pattern the business name next to it already
       * uses. */}
      <span className="hidden sm:inline">Log out</span>
    </button>
  );
}
