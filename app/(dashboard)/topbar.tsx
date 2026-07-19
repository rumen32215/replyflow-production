import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignOutButton } from "@/app/(dashboard)/sign-out-button";
import { Logo } from "@/components/shared/logo";
import { TopbarNav } from "@/app/(dashboard)/topbar-nav";

/**
 * Settings lives here — genuine account preferences don't earn a
 * primary tab (Dashboard Map: five destinations only). On mobile the
 * topbar also carries the logo, since the sidebar is hidden.
 */
export function Topbar({
  businessName,
  logoUrl,
}: {
  businessName: string;
  logoUrl: string | null;
}) {
  return (
    <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-border bg-card px-4 md:h-[73px] md:px-8">
      <div className="md:hidden">
        <Logo />
      </div>
      <div className="hidden md:block" />
      <div className="flex items-center gap-2 md:gap-3">
        {/* Mission Control, Customers, Everything I Know, Settings —
         * reachable from here rather than as primary tabs (Dashboard
         * Map decision). Sprint 8.5 gave this row a real active state;
         * see topbar-nav.tsx. */}
        <TopbarNav />
        <Avatar className="h-9 w-9 border border-border">
          {logoUrl && <AvatarImage src={logoUrl} alt={businessName} />}
          <AvatarFallback className="text-xs">{businessName.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="hidden text-[13.5px] font-semibold sm:inline">{businessName}</span>
        <SignOutButton />
      </div>
    </header>
  );
}
