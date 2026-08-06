"use client";

import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A restrained mouse-tracking spotlight, rebuilt from a 21st.dev
 * reference component's *mechanism* only (V22) — not its appearance.
 * ReplyFlow's own `primary → success` gradient instead of purple, sits
 * on the app's real card tokens (`rounded-3xl`, `border-border`,
 * `bg-card`, `shadow-elevated`) rather than inventing new ones, and
 * stays capped low enough to read as quality, not an effect calling
 * attention to itself — "expensive, not flashy."
 *
 * Also responds to focus (keyboard) and holds a faint default presence
 * on touch devices, since raw `mousemove` tracking is invisible on a
 * phone and these cards are meant to be reviewed there.
 */
export function GlowCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 50, y: 30 });
  const [active, setActive] = useState(false);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border bg-card shadow-elevated motion-reduce:transition-none",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 ease-out motion-reduce:hidden"
        style={{
          opacity: active ? 0.5 : 0,
          background: `radial-gradient(280px circle at ${pos.x}% ${pos.y}%, rgba(37,99,235,0.16), rgba(22,163,74,0.10) 55%, transparent 75%)`,
        }}
      />
      {/* A faint, static presence for touch devices — mousemove never
       * fires there, and this is meant to be reviewed on a phone. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12] [@media(hover:hover)]:hidden"
        style={{ background: "radial-gradient(280px circle at 50% 0%, rgba(37,99,235,0.16), transparent 70%)" }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
