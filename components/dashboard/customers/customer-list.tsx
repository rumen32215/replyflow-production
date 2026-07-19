"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Clock3, MessageCircle, Search, Sparkles, Users } from "lucide-react";
import { Reveal, press } from "@/components/shared/motion";
import { EmptyState } from "@/components/shared/empty-state";
import { groupForStatus, statusLabel, type ConversationGroup } from "@/lib/conversations";
import type { RelationshipStrength } from "@/lib/customer-memory-signals";
import { cn } from "@/lib/utils";

/**
 * Left panel — customer list, search, and filters (Feature 12 UI).
 * Search here is a plain, honest text filter on name/phone — not the
 * natural-language search the spec describes ("customers waiting for
 * quotes"), which would need real LLM understanding this sprint
 * explicitly doesn't build. See Sprint 7's report for that limitation.
 */
export interface CustomerListItem {
  id: string;
  name: string;
  phone: string;
  status: string;
  /** Pre-formatted server-side (e.g. "18 minutes ago") — never computed
   * here from a raw timestamp. This is a Client Component; recomputing
   * a relative time client-side at hydration would drift from what the
   * server rendered a moment earlier as real time passes, producing a
   * hydration mismatch (found and fixed during Sprint 7 verification). */
  lastActivityLabel: string | null;
  completedJobCount: number;
  strength: RelationshipStrength;
}

type FilterId = "all" | "waiting" | "returning";
const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "waiting", label: "Waiting" },
  { id: "returning", label: "Returning" },
];

const GROUP_STYLE: Record<ConversationGroup, string> = {
  waiting: "bg-attention/10 text-attention",
  active: "bg-accent text-primary",
  booked: "bg-success/10 text-success",
  done: "bg-muted text-muted-foreground",
};

export function CustomerList({ customers }: { customers: CustomerListItem[] }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !c.phone.includes(q)) return false;
      if (filter === "waiting" && groupForStatus(c.status) !== "waiting") return false;
      if (filter === "returning" && c.completedJobCount === 0) return false;
      return true;
    });
  }, [customers, query, filter]);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-3 border-b border-border p-4">
        <h1 className="text-[17px] font-extrabold tracking-tight">Customers</h1>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or number"
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
          />
        </div>
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full px-3 py-1 text-[12px] font-semibold transition-colors",
                filter === f.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          customers.length === 0 ? (
            <FirstCustomerTeaser />
          ) : (
            <EmptyState icon={Users} title="No matches." description="Try a different search or filter." />
          )
        ) : (
          <div className="space-y-1.5">
            {filtered.map((c, i) => {
              const href = `/dashboard/customers/${c.id}`;
              const active = pathname === href;
              const group = groupForStatus(c.status);
              return (
                <Reveal key={c.id} index={Math.min(i, 8)}>
                  <Link href={href} className="block">
                    <motion.div
                      {...press}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border p-3.5 transition-colors",
                        active ? "border-primary/40 bg-accent/60" : "border-border bg-card hover:bg-muted/40"
                      )}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-primary">
                        {c.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[13.5px] font-semibold">{c.name}</p>
                          {c.lastActivityLabel && (
                            <span className="shrink-0 text-[11px] text-muted-foreground">{c.lastActivityLabel}</span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", GROUP_STYLE[group])}>
                            {statusLabel(c.status)}
                          </span>
                          {c.completedJobCount > 0 && (
                            <span className="truncate text-[11px] text-muted-foreground">{c.strength}</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Sprint 7.5: the empty state used to say only "No customers yet" —
 * honest, but it left the owner guessing what this page is even for.
 * This teaches what Customer Memory becomes once real conversations
 * exist — every line names something the product genuinely already
 * builds (relationship strength, timeline, service history — see
 * lib/customer-memory-signals.ts), never a feature that doesn't exist
 * yet. Teaching, not pretending: no fake customer is shown.
 */
function FirstCustomerTeaser() {
  const points = [
    { icon: MessageCircle, text: "Who they are and how the relationship started" },
    { icon: Clock3, text: "A timeline of every job, from enquiry to completion" },
    { icon: Sparkles, text: "What to do next — never a random suggestion" },
  ];

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Users className="h-5 w-5" />
      </div>
      <div className="px-4">
        <p className="text-[14px] font-semibold">No customers yet.</p>
        <p className="mt-1 max-w-[240px] text-[13px] leading-relaxed text-muted-foreground">
          Once your first enquiry arrives, I&apos;ll start remembering them here — this is what you&apos;ll see for
          every customer:
        </p>
      </div>
      <div className="w-full space-y-2.5 px-5 text-left">
        {points.map((point) => (
          <div key={point.text} className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
              <point.icon className="h-3 w-3" />
            </span>
            <span className="text-[12.5px] leading-snug text-muted-foreground">{point.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
