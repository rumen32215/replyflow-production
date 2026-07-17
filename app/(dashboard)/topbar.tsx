import Link from "next/link";
import { Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignOutButton } from "@/app/(dashboard)/sign-out-button";
import { Logo } from "@/components/shared/logo";

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
        <Link
          href="/dashboard/settings"
          aria-label="Settings"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Settings className="h-[17px] w-[17px]" />
        </Link>
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
