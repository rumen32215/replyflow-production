"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";

export function ResendEmailButton({ email }: { email: string }) {
  const supabase = createClient();
  const [sending, setSending] = useState(false);

  async function resend() {
    setSending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setSending(false);

    toast(
      error
        ? { variant: "destructive", title: "Couldn't resend", description: error.message }
        : { variant: "success", title: "Email sent", description: `We've resent the link to ${email}.` }
    );
  }

  return (
    <button
      onClick={resend}
      disabled={sending}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline disabled:opacity-60"
    >
      {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      Resend email
    </button>
  );
}
