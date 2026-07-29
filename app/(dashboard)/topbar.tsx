import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignOutButton } from "@/app/(dashboard)/sign-out-button";
import { Logo } from "@/components/shared/logo";
import { MobileSecondaryNav } from "@/app/(dashboard)/mobile-secondary-nav";

/**
 * On mobile the topbar also carries the logo (sidebar is hidden) and
 * the two secondary destinations that don't fit the bottom tab bar
 * (Hours, Settings — see mobile-secondary-nav.tsx). Desktop's sidebar
 * already shows all six destinations, so the secondary nav hides
 * there entirely rather than repeating them.
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
      <div className="flex items-center gap-2 md:gap-3">
        <div className="flex items-center gap-1 md:hidden">
          <MobileSecondaryNav approvalsCount={approvalsCount} />
        </div>
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
