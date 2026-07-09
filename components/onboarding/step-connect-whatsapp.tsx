"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, MessageCircle } from "lucide-react";
import { StepShell } from "@/components/onboarding/step-shell";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";
import { cn } from "@/lib/utils";

const TRUST_ITEMS = ["Secure", "Official WhatsApp API", "Under 2 minutes"];

/**
 * Placeholder connection flow per the brief: this simulates the real
 * WhatsApp Cloud API "Embedded Signup" experience (loading -> connected)
 * without calling Meta. The real integration is Phase 3 of the roadmap
 * and needs its own spike — see the co-founder notes on verification
 * delays before wiring this up for real.
 */
export function StepConnectWhatsApp() {
  const router = useRouter();
  const { businessName, whatsappStatus, setField } = useOnboardingStore();
  const [localStatus, setLocalStatus] = useState(whatsappStatus);

  useEffect(() => {
    if (localStatus === "connected") {
      setField("whatsappStatus", "connected");
      const t = setTimeout(() => router.push("/onboarding/business-details"), 900);
      return () => clearTimeout(t);
    }
  }, [localStatus, router, setField]);

  function connect() {
    setLocalStatus("connecting");
    setTimeout(() => setLocalStatus("connected"), 1200);
  }

  const connected = localStatus === "connected";
  const connecting = localStatus === "connecting";

  return (
    <StepShell
      step={2}
      title="Connect your WhatsApp Business"
      subtitle="This is where the magic happens — every enquiry routes straight to ReplyFlow."
      backHref="/onboarding/business-info"
    >
      <div
        className={cn(
          "mb-5 rounded-2xl border-[1.5px] border-dashed border-border p-8 text-center transition-colors",
          connected && "border-solid border-success/25 bg-success/5"
        )}
      >
        <div
          className={cn(
            "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success transition-transform",
            connected && "scale-105 bg-success text-white"
          )}
        >
          {connecting ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : connected ? (
            <Check className="h-6 w-6" strokeWidth={3} />
          ) : (
            <MessageCircle className="h-6 w-6" />
          )}
        </div>

        <p className="mb-1 text-[15px] font-bold">
          {connected
            ? `Connected as ${businessName || "your business"}`
            : connecting
            ? "Connecting to WhatsApp..."
            : "Link your WhatsApp Business account"}
        </p>
        <p className="mb-5 text-[13px] text-muted-foreground">
          {connected
            ? "Messages will now route through ReplyFlow."
            : connecting
            ? "This usually takes a few seconds."
            : "One click — no phone number changes needed."}
        </p>

        {!connected && (
          <Button variant="success" onClick={connect} disabled={connecting} className="mx-auto w-auto px-6">
            {connecting ? "Connecting..." : "Connect WhatsApp"}
          </Button>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-center gap-4">
        {TRUST_ITEMS.map((item) => (
          <span key={item} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-success" strokeWidth={3} />
            {item}
          </span>
        ))}
      </div>

      <Button
        variant="default"
        className="w-full"
        disabled={!connected}
        onClick={() => router.push("/onboarding/business-details")}
      >
        Continue
      </Button>
    </StepShell>
  );
}
