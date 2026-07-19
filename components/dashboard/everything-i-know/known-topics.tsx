import Link from "next/link";
import { Check } from "lucide-react";
import { SettleCard, Reveal } from "@/components/shared/motion";
import { DOMAIN_META, groupTopicsByDomain } from "@/lib/everything-i-know-signals";
import type { BrainDomain, BrainTopic } from "@/lib/brain";

const DOMAIN_ORDER: BrainDomain[] = ["knowledge", "receptionist", "diary"];

/**
 * "What I know" — every topic the Shared Brain has marked `done`,
 * grouped the same way Business Knowledge/Receptionist/Diary already
 * divide the product, phrased as a plain sentence using the topic's
 * own real label. Each row links to where it was taught, answering
 * Feature 11's "can I change it?" without a second edit surface.
 */
export function KnownTopics({ topics }: { topics: readonly BrainTopic[] }) {
  if (topics.length === 0) return null;
  const grouped = groupTopicsByDomain(topics);

  return (
    <SettleCard delay={0.06} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">What I know</h2>
      <div className="space-y-5">
        {DOMAIN_ORDER.map((domain) => {
          const list = grouped[domain] ?? [];
          if (list.length === 0) return null;
          return (
            <div key={domain}>
              <h3 className="mb-2 text-[13px] font-bold tracking-tight">{DOMAIN_META[domain].heading}</h3>
              <div className="space-y-1">
                {list.map((topic, i) => (
                  <Reveal key={topic.id} index={i}>
                    <Link
                      href={topic.href}
                      className="-mx-1 flex items-start gap-2.5 rounded-lg px-1 py-1 text-[13.5px] transition-colors hover:bg-muted/50"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                        <Check className="h-3 w-3" />
                      </span>
                      <span className="leading-relaxed">I know {topic.label}.</span>
                    </Link>
                  </Reveal>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </SettleCard>
  );
}
