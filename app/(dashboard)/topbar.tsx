import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignOutButton } from "@/app/(dashboard)/sign-out-button";

export function Topbar({
  businessName,
  logoUrl,
}: {
  businessName: string;
  logoUrl: string | null;
}) {
  return (
    <header className="flex h-[73px] shrink-0 items-center justify-between border-b border-border bg-card px-8">
      <div />
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8 border border-border">
          {logoUrl && <AvatarImage src={logoUrl} alt={businessName} />}
          <AvatarFallback className="text-xs">{businessName.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="text-[13.5px] font-semibold">{businessName}</span>
        <SignOutButton />
      </div>
    </header>
  );
}
