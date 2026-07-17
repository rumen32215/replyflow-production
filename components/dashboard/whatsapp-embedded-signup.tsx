"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { Check, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GentleSwap } from "@/components/shared/motion";
import { toast } from "@/hooks/use-toast";

declare global {
  interface Window {
    FB?: {
      init: (params: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }) => void;
      login: (
        callback: (response: { authResponse?: { code?: string } }) => void,
        options: Record<string, unknown>
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

type SignupState = "idle" | "awaiting-signup" | "connecting" | "connected" | "error";

/**
 * Meta's Embedded Signup reports success through two separate
 * channels that arrive independently and in no guaranteed order:
 *   1. FB.login's own callback -> an authorization `code`
 *   2. A window "message" event with data.type === "WA_EMBEDDED_SIGNUP"
 *      -> the actual waba_id / phone_number_id the merchant selected
 * We need all three values before calling our backend, so both are
 * captured into refs and reconciled in tryFinish() whichever arrives last.
 */
export function WhatsAppEmbeddedSignup({ redirectTo }: { redirectTo?: string } = {}) {
  const router = useRouter();
  const [state, setState] = useState<SignupState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

  const codeRef = useRef<string | null>(null);
  const wabaIdRef = useRef<string | null>(null);
  const phoneNumberIdRef = useRef<string | null>(null);

  const appId = process.env.NEXT_PUBLIC_WHATSAPP_APP_ID;
  const configId = process.env.NEXT_PUBLIC_WHATSAPP_CONFIG_ID;

  useEffect(() => {
    window.fbAsyncInit = () => {
      if (!appId) return;
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version: "v20.0" });
      setSdkReady(true);
    };

    function handleMessage(event: MessageEvent) {
      if (!event.origin.endsWith("facebook.com")) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type !== "WA_EMBEDDED_SIGNUP") return;

        if (data.event === "FINISH") {
          wabaIdRef.current = data.data?.waba_id ?? null;
          phoneNumberIdRef.current = data.data?.phone_number_id ?? null;
          tryFinish();
        } else if (data.event === "CANCEL") {
          setState("idle");
        } else if (data.event === "ERROR") {
          setState("error");
          setErrorMessage(data.data?.error_message ?? "Signup was cancelled or failed.");
        }
      } catch {
        // Not a JSON message we care about — ignore.
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  async function tryFinish() {
    if (!codeRef.current || !wabaIdRef.current || !phoneNumberIdRef.current) return; // still waiting on one of the three

    setState("connecting");
    try {
      const res = await fetch("/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeRef.current,
          wabaId: wabaIdRef.current,
          phoneNumberId: phoneNumberIdRef.current,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Connection failed");

      setState("connected");
      toast({ variant: "success", title: "WhatsApp connected", description: data.displayPhoneNumber });
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    } catch (err) {
      setState("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function startSignup() {
  // Development bypass
  if (!window.FB || !configId) {
    router.push(redirectTo ?? "/dashboard");
      return;
    }

    codeRef.current = null;
    wabaIdRef.current = null;
    phoneNumberIdRef.current = null;
    setState("awaiting-signup");

    window.FB.login(
      (response) => {
        if (response.authResponse?.code) {
          codeRef.current = response.authResponse.code;
          tryFinish();
        } else {
          setState("idle");
        }
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, sessionInfoVersion: "3" },
      }
    );
  }

  const missingConfig = !appId || !configId;

  return (
    <div className="rounded-2xl border-[1.5px] border-dashed border-border p-8 text-center">
      <Script src="https://connect.facebook.net/en_US/sdk.js" strategy="lazyOnload" onLoad={() => setSdkReady(true)} />

      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
        <GentleSwap swapKey={state}>
          {state === "connecting" || state === "awaiting-signup" ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : state === "connected" ? (
            <Check className="h-6 w-6" strokeWidth={3} />
          ) : (
            <MessageCircle className="h-6 w-6" />
          )}
        </GentleSwap>
      </div>

      <p className="mb-1 text-[15px] font-bold">
        {state === "connected"
          ? "I'm connected"
          : state === "connecting"
          ? "Finishing up..."
          : state === "awaiting-signup"
          ? "Complete signup in the popup..."
          : "Connect your WhatsApp Business account"}
      </p>
      <p className="mb-5 text-[13px] text-muted-foreground">
        {state === "error"
          ? errorMessage
          : missingConfig
          ? "This environment isn't set up for WhatsApp yet."
          : "I'll guide you through Meta's official signup flow."}
      </p>

      {state !== "connected" && (
        <Button
          variant="success"
          onClick={startSignup}
          disabled={state === "connecting" || state === "awaiting-signup"}
          className="mx-auto w-auto px-6"
        >
          {state === "connecting" || state === "awaiting-signup" ? "Connecting..." : "Connect WhatsApp"}
        </Button>
      )}
    </div>
  );
}
