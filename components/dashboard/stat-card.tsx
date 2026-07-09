import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: "default" | "success";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div
        className={cn(
          "mb-4 flex h-9 w-9 items-center justify-center rounded-[10px]",
          tone === "success" ? "bg-success/10 text-success" : "bg-accent text-primary"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-2xl font-extrabold tracking-tight">{value}</p>
      <p className="mt-0.5 text-[13px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
