import { cn } from "@/lib/utils";

/**
 * The premium device chassis for the Landing Experience Hero
 * (`DOCS/SPECS/ReplyFlow-Landing-Experience-Design.md` §2). Third
 * founder review (2026-08-04): "the phone becomes the product" — a
 * believable product demonstration, not a decorative rounded
 * rectangle. This wraps the existing `PhoneFrame`/`Bubble` conversation
 * UI (`components/shared/phone-preview.tsx`) unchanged — conversation
 * logic and the WhatsApp-style header stay exactly what they already
 * are; only the outer presentation is new.
 *
 * Deliberately its own component, not a change to the shared
 * `PhoneFrame` — that component is real, load-bearing UI inside the
 * authenticated product (onboarding, Test Conversations), where a
 * lighter, teaching-context frame is correct. This chrome is specific
 * to the Hero's "product shot" moment and has no reason to leak
 * anywhere else.
 *
 * No new colours — the chassis is a neutral dark gradient (a real
 * device's own colour, not a brand colour), matching Visual Language
 * §3's rule that brand colour stays reserved for the two real tokens.
 */
export function DeviceFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <div className="relative rounded-[46px] bg-gradient-to-b from-[#3c3c42] via-[#1c1c1f] to-[#0a0a0c] px-[10px] pb-[10px] pt-8 shadow-[0_60px_120px_-24px_rgba(15,23,42,0.5),0_30px_60px_-30px_rgba(15,23,42,0.4)]">
        {/* Edge highlight — a real object catching light, not decoration. */}
        <div className="pointer-events-none absolute inset-0 rounded-[46px] ring-1 ring-inset ring-white/10" aria-hidden />

        {/* Camera/notch cutout, sitting in its own bezel space above the
         * screen — never overlapping real content. */}
        <div className="absolute left-1/2 top-3 z-20 h-[15px] w-20 -translate-x-1/2 rounded-full bg-[#0a0a0c]" aria-hidden />

        <div className="relative overflow-hidden rounded-[32px]">
          {children}

          {/* A single soft glass highlight, static — suggests a real
           * screen surface without adding a second thing that moves. */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.07] via-transparent to-transparent"
            aria-hidden
          />

          {/* Home indicator. */}
          <div className="pointer-events-none absolute bottom-2 left-1/2 z-20 h-1 w-24 -translate-x-1/2 rounded-full bg-foreground/15" aria-hidden />
        </div>
      </div>
    </div>
  );
}
