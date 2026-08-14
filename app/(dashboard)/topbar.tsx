import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignOutButton } from "@/app/(dashboard)/sign-out-button";
import { Logo } from "@/components/shared/logo";
import { MobileSecondaryNav } from "@/app/(dashboard)/mobile-secondary-nav";

/**
 * On mobile the topbar also carries the logo (sidebar is hidden) and
 * the six secondary destinations that don't fit the bottom tab bar
 * (Receptionist, WhatsApp, Approvals, Job Records, Hours, Settings —
 * see mobile-secondary-nav.tsx; comment corrected 2026-08-14, this used
 * to say "the two secondary destinations" from before the other four
 * were added). Desktop's sidebar already shows all destinations, so
 * the secondary nav hides there entirely rather than repeating them.
 * The row scrolls horizontally (overflow-x-auto below) as a safety net
 * on the narrowest phones, rather than silently clipping a destination.
 */
export function Topbar({
  businessName,
  logoUrl,
  approvalsCount = 0,
}: {
  businessName: string;
  logoUrl: string | null;
  approvalsCount?: number;
}) {
  return (
    <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-border bg-card px-4 md:h-[73px] md:px-8">
      <div className="md:hidden">
        <Logo />
      </div>
      <div className="hidden md:block" />
      <div className="flex min-w-0 items-center gap-2 md:gap-3">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto md:hidden">
          <MobileSecondaryNav approvalsCount={approvalsCount} />
        </div>
        <Avatar className="h-9 w-9 shrink-0 border border-border">
          {logoUrl && <AvatarImage src={logoUrl} alt={businessName} />}
          <AvatarFallback className="text-xs">{businessName.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="hidden shrink-0 text-[13.5px] font-semibold sm:inline">{businessName}</span>
        <span className="shrink-0">
          <SignOutButton />
        </span>
      </div>
    </header>
  );
}
