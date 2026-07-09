import Link from "next/link";
import { Bot, MessageCircle, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TRUST_ITEMS = [
  { icon: ShieldCheck, label: "Secure" },
  { icon: MessageCircle, label: "Official WhatsApp API" },
  { icon: Zap, label: "Under 2 minutes" },
];

/**
 * The dashboard's primary call-to-action while there's no real activity
 * to show yet. Two states, both driven by real data (whatsapp_connected
 * from Supabase) — never a generic "no data" placeholder:
 *
 *  - not connected: push the owner to finish connecting WhatsApp. This
 *    is intentionally the loudest thing on the page — everything else
 *    (stats, recent enquiries) is secondary until this is done.
 *  - connected, just no enquiries yet: reassure rather than nag. The
 *    WhatsApp connection today is still onboarding's simulation (see
 *    step-connect-whatsapp.tsx), so this copy is written to stay true
 *    once the real Cloud API integration replaces it.
 */
export function ActivationHero({
  whatsappConnected,
}: {
  whatsappConnected: boolean;
}) {
  return (
    <div
      className={cn(
        "relative mb-8 overflow-hidden rounded-3xl border p-8 shadow-elevated sm:p-10",
        whatsappConnected ? "border-border bg-card" : "border-primary/15 bg-card"
      )}
    >
      {!whatsappConnected && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 88% 12%, rgba(37,99,235,0.10), transparent 55%), radial-gradient(circle at 10% 110%, rgba(34,197,94,0.08), transparent 50%)",
          }}
        />
      )}

      <div className="relative flex flex-col items-start gap-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <div className="mb-5 flex items-center gap-2.5">
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-2xl",
                whatsappConnected ? "bg-accent text-primary" : "bg-foreground text-background"
              )}
            >
              <Bot className="h-5 w-5" />
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold",
                whatsappConnected ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  whatsappConnected ? "bg-success animate-pulse" : "bg-muted-foreground"
                )}
              />
              {whatsappConnected ? "Waiting for first enquiry" : "AI receptionist offline"}
            </span>
          </div>

          <h2 className="mb-2.5 text-[24px] font-extrabold leading-tight tracking-tight sm:text-[28px]">
            {whatsappConnected
              ? "You're connected. Your first enquiry will show up here."
              : "Your AI receptionist isn't active yet."}
          </h2>

          <p className="mb-6 text-[14.5px] leading-relaxed text-muted-foreground">
            {whatsappConnected
              ? "WhatsApp is connected — as soon as a customer messages your business number, ReplyFlow will reply instantly and this dashboard will fill in automatically."
              : "Connect your WhatsApp Business account so ReplyFlow can start replying to enquiries instantly, qualifying leads, and filling in this dashboard for you."}
          </p>

          {!whatsappConnected && (
            <>
              <Link href="/dashboard/whatsapp">
                <Button variant="primary" size="lg">
                  Connect WhatsApp
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
                {TRUST_ITEMS.map((item) => (
                  <span
                    key={item.label}
                    className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground"
                  >
                    <item.icon className="h-3.5 w-3.5 text-success" />
                    {item.label}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div
          className={cn(
            "relative hidden h-32 w-32 shrink-0 items-center justify-center rounded-3xl sm:flex",
            whatsappConnected ? "bg-success/5" : "bg-accent"
          )}
        >
          <Bot className={cn("h-14 w-14", whatsappConnected ? "text-success/40" : "text-primary/30")} />
        </div>
      </div>
    </div>
  );
}
