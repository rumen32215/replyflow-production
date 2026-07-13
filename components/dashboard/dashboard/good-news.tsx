import { MessagesSquare, Banknote, Clock } from "lucide-react";
import { formatMoney, formatDuration } from "@/lib/dashboard-signals";

export interface GoodNewsInput {
  enquiriesToday: number;
  potentialWorkWon: number;
  estimatedMinutesSaved: number;
}

/** Doesn't render on day one — a hollow "your first win is coming"
 * message is enthusiasm with nothing behind it. This only appears once
 * at least one of its lines is genuinely true. */
export function GoodNews({ enquiriesToday, potentialWorkWon, estimatedMinutesSaved }: GoodNewsInput) {
  const lines: { icon: typeof MessagesSquare; text: string }[] = [];

  if (enquiriesToday > 0) {
    lines.push({
      icon: MessagesSquare,
      text: `ReplyFlow looked after ${enquiriesToday} ${enquiriesToday === 1 ? "customer" : "customers"} today`,
    });
  }
  if (potentialWorkWon > 0) {
    lines.push({ icon: Banknote, text: `Won ${formatMoney(potentialWorkWon)} of potential work` });
  }
  if (estimatedMinutesSaved > 0) {
    lines.push({
      icon: Clock,
      text: `An estimated ${formatDuration(estimatedMinutesSaved)} saved, based on ReplyFlow answering while you were busy`,
    });
  }

  if (lines.length === 0) return null;

  return (
    <section className="rounded-2xl border border-success/20 bg-success/[0.03] p-6">
      <h2 className="mb-4 text-[13px] font-semibold text-success">Good news</h2>
      <ul className="space-y-2.5">
        {lines.map((line, i) => (
          <li key={i} className="flex items-center gap-3 text-[14px]">
            <line.icon className="h-4 w-4 shrink-0 text-success" />
            {line.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
