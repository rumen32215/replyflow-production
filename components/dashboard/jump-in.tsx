import Link from "next/link";
import { MessagesSquare, Sparkles, Building2, Settings } from "lucide-react";

const ACTIONS = [
  { href: "/dashboard/conversations", label: "Inbox", description: "Every conversation", icon: MessagesSquare },
  { href: "/dashboard/ai-receptionist", label: "Training", description: "How ReplyFlow sounds", icon: Sparkles },
  { href: "/dashboard/business-profile", label: "Business", description: "Hours, areas, services", icon: Building2 },
  { href: "/dashboard/settings", label: "Settings", description: "Account & notifications", icon: Settings },
] as const;

/** Only real destinations — Customers, Quotes, and Photos aren't pages
 * yet, so they don't get cards yet either. This grows honestly as each
 * one ships, rather than promising doors that don't open. */
export function JumpIn() {
  return (
    <section>
      <h2 className="mb-3 text-[13px] font-semibold text-muted-foreground">Jump in</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-5 transition-all duration-150 hover:border-muted-foreground/30 hover:shadow-sm active:scale-[0.98]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">
              <action.icon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-[14px] font-semibold">{action.label}</span>
              <span className="block text-[12px] text-muted-foreground">{action.description}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
