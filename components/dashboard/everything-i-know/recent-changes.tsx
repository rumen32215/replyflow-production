import { Clock3 } from "lucide-react";
import { SettleCard } from "@/components/shared/motion";

/**
 * "What changed recently" — real `updated_at` timestamps, nothing
 * else. There is no per-field history in the schema, so this can only
 * say a row was written to, not exactly what changed within it (see
 * lib/everything-i-know-signals.ts). Honest and general beats specific
 * and wrong.
 */
export function RecentChanges({ changes }: { changes: readonly string[] }) {
  return (
    <SettleCard delay={0.14} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Recently changed</h2>
      {changes.length === 0 ? (
        <div className="flex items-center gap-2.5 text-[13.5px] text-muted-foreground">
          <Clock3 className="h-4 w-4" />
          <span>Nothing in the last two weeks.</span>
        </div>
      ) : (
        <ul className="space-y-2">
          {changes.map((change, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-learning" />
              <span>{change}</span>
            </li>
          ))}
        </ul>
      )}
    </SettleCard>
  );
}
