export function MorningBrief({ text }: { text: string }) {
  return (
    <section className="rounded-2xl border border-border bg-accent/40 p-6">
      <h2 className="mb-2 text-[12.5px] font-semibold uppercase tracking-wide text-primary">ReplyFlow says...</h2>
      <p className="text-[15px] leading-relaxed">{text}</p>
    </section>
  );
}
