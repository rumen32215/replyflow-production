import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { SettleCard, Reveal } from "@/components/shared/motion";
import { ConfidenceBar } from "@/components/shared/confidence-bar";
import { DOMAIN_META, groupTopicsByDomain } from "@/lib/everything-i-know-signals";
import { joinList } from "@/lib/knowledge";
import type { BrainDomain, BrainTopic } from "@/lib/brain";

const DOMAIN_ORDER: BrainDomain[] = ["knowledge", "receptionist", "diary"];
const DOMAIN_HREF: Record<BrainDomain, string> = {
  knowledge: "/dashboard/business",
  receptionist: "/dashboard/receptionist",
  diary: "/dashboard/availability",
};

/**
 * "Still learning" (Sprint 8.5 rewrite) — used to render every gap as
 * its own card with its own "Teach me" button, up to a dozen identical
 * blue buttons in a row. That read as a survey, not the Shared Brain —
 * exactly what this sprint asked to fix. Now it's a calm, per-domain
 * progress summary (reusing `ConfidenceBar`, not inventing a second
 * progress visual) plus one plain-language sentence naming what's
 * still unknown, and exactly one link per domain — never a link per
 * topic. The actual teaching still only happens on the pages that
 * already own it (Business Knowledge, Receptionist, Diary) and via
 * Front Desk's single ranked Recommendations — this page reports
 * understanding, it doesn't duplicate the nudge.
 */
export function LearningTopics({
  gaps,
  percentByDomain,
}: {
  gaps: readonly BrainTopic[];
  percentByDomain: Record<BrainDomain, number>;
}) {
  if (gaps.length === 0) {
    return (
      <SettleCard delay={0.1} className="rounded-2xl border border-success/25 bg-success/5 p-6 shadow-sm">
        <p className="text-[14px] font-semibold">I know everything I need right now.</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">If anything changes, I&apos;ll list it here.</p>
      </SettleCard>
    );
  }

  const grouped = groupTopicsByDomain(gaps);

  return (
    <SettleCard delay={0.1} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Still learning</h2>
      <div className="space-y-5">
        {DOMAIN_ORDER.map((domain, i) => {
          const list = grouped[domain] ?? [];
          if (list.length === 0) return null;
          const important = list.some((t) => t.important);
          const labels = list.map((t) => t.label);
          const shown = labels.slice(0, 3);
          const remainder = labels.length - shown.length;
          const summary = remainder > 0 ? `${joinList(shown)}, and ${remainder} more` : joinList(shown);

          return (
            <Reveal key={domain} index={i}>
              <div>
                <ConfidenceBar
                  title={DOMAIN_META[domain].heading}
                  percent={percentByDomain[domain] ?? 0}
                  caption={`${list.length} ${list.length === 1 ? "thing" : "things"} still to learn`}
                />
                <p className="mt-2.5 flex items-start gap-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  {important && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-attention" />}
                  <span>Still to learn: {summary}.</span>
                </p>
                <Link
                  href={DOMAIN_HREF[domain]}
                  className="mt-2 inline-block text-[12.5px] font-semibold text-primary transition-colors hover:text-primary/80"
                >
                  Continue teaching →
                </Link>
              </div>
            </Reveal>
          );
        })}
      </div>
    </SettleCard>
  );
}
