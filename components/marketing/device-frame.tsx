import { cn } from "@/lib/utils";

/**
 * The premium device chassis for the Landing Experience Hero
 * (`DOCS/SPECS/ReplyFlow-Landing-Experience-Design.md` §2). Fourth
 * founder review (2026-08-04): "believable, not custom-built" — a real
 * phone is a fixed physical object; only what's on its screen moves.
 *
 * The previous version had no fixed height, so the chassis itself grew
 * as each conversation's message count changed — the device becoming
 * part of the animation, exactly the illusion this version exists to
 * remove. The screen area below is now a fixed size; conversation
 * content scrolls inside it (`overflow-y-auto`, auto-scrolled to the
 * newest message by the caller), the same way a real phone screen
 * never resizes itself to fit what's on it.
 *
 * Also thinner bezel and a less exaggerated corner radius than the
 * first version, per the same review — restrained enough to read as a
 * real device, not an illustration of one.
 *
 * Wraps the existing `PhoneFrame`/`Bubble` conversation UI unchanged —
 * this is presentation only, never a change to that shared component
 * (still real, load-bearing UI inside the authenticated product).
 */
export function DeviceFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <div className="relative rounded-[38px] bg-gradient-to-b from-[#38383d] via-[#19191c] to-[#0a0a0c] p-[6px] pt-6 shadow-[0_50px_100px_-24px_rgba(15,23,42,0.5),0_25px_50px_-28px_rgba(15,23,42,0.4)]">
        {/* Edge highlight — a real object catching light, not decoration. */}
        <div className="pointer-events-none absolute inset-0 rounded-[38px] ring-1 ring-inset ring-white/10" aria-hidden />

        {/* Camera/notch cutout, sitting in its own bezel space above the
         * screen — never overlapping real content. */}
        <div className="absolute left-1/2 top-2.5 z-20 h-[13px] w-16 -translate-x-1/2 rounded-full bg-[#0a0a0c]" aria-hidden />

        {/* Fixed-size screen — this is the one dimension that must never
         * change with content. Conversations scroll inside it instead. */}
        <div className="relative h-[540px] w-full overflow-hidden rounded-[30px]">
          {children}

          {/* A single soft glass highlight, static — suggests a real
           * screen surface without adding a second thing that moves. */}
          <div
            className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent"
            aria-hidden
          />

          {/* Home indicator. */}
          <div className="pointer-events-none absolute bottom-1.5 left-1/2 z-20 h-1 w-24 -translate-x-1/2 rounded-full bg-white/25" aria-hidden />
        </div>
      </div>
    </div>
  );
}
