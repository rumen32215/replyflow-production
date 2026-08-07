import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { SettleCard } from "@/components/shared/motion";
import type { ConnectionHealth } from "@/lib/front-desk-signals";

/**
 * Connection Alert (Blueprint checklist 3.2) — the reversed version of
 * "add WhatsApp to primary nav." A permanent nav item for something
 * that's fine 99% of the time is its own kind of clutter; the real
 * fix is Front Desk noticing the one time it isn't fine. Only ever
 * renders for expiring_soon/expired — silent otherwise, same as every
 * other section on this page.
 */
export function ConnectionAlert({ health }: { health: ConnectionHealth }) {
  if (health.status !== "expiring_soon" && health.status !== "expired" && health.status !== "revoked") return null;

  // Revoked and expired are both urgent/red — a revoke can happen with
  // token_expires_at still comfortably in the future, so it needs the
  // same visual urgency as "expired," just distinct wording.
  const urgent = health.status === "expired" || health.status === "revoked";
  const headline =
    health.status === "revoked"
      ? "WhatsApp connection disconnected"
      : health.status === "expired"
      ? "WhatsApp connection expired"
      : "WhatsApp connection expiring soon";

  return (
    <SettleCard delay={0.03}>
      <Link href="/dashboard/whatsapp" className="group block">
        <div
          className={`flex items-center gap-3 rounded-2xl border-l-4 p-4 pl-3.5 transition-shadow group-hover:shadow-sm ${
            urgent ? "border-destructive bg-destructive/[0.06]" : "border-attention bg-attention/[0.06]"
          }`}
        >
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              urgent ? "bg-destructive/15 text-destructive" : "bg-attention/15 text-attention"
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold">{headline}</p>
            <p className="truncate text-[12.5px] text-muted-foreground">{health.message}</p>
          </div>
        </div>
      </Link>
    </SettleCard>
  );
}
