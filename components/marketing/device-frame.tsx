import { cn } from "@/lib/utils";

/**
 * The premium device chassis for the Landing Experience Hero
 * (`DOCS/SPECS/ReplyFlow-Landing-Experience-Design.md` §2).
 *
 * Sixth founder review (2026-08-04) — rebuilt, not iterated. The
 * previous version fixed a *height* but let width fill its container
 * (`h-[540px] w-full`), and the container was wide enough that the
 * rendered proportions came out around 0.69 (width÷height) — a real
 * iPhone is close to 0.48. No amount of lighting or shadow work reads
 * as "a real phone" while the actual shape is closer to a stubby card
 * than a phone, so this was very likely the root cause of "still
 * feels like a demo component," not a rendering-detail problem. Fixed
 * via `aspect-[9/19.5]` with a responsive width only — height is
 * always derived, so the proportion itself can never drift again.
 *
 * Also rebuilt: a thin, uniform bezel (`p-[3px]`) instead of a
 * separate top bezel strip for the camera — a real edge-to-edge phone
 * doesn't have a "forehead," the camera cutout floats as its own
 * island *inside* the screen area, on top of whatever content is
 * there (exactly how a real iPhone renders a coloured app header
 * behind the Dynamic Island). Physical side-button silhouettes
 * (volume, power) were added for the same reason — a flat rounded
 * rectangle reads as an icon; a rounded rectangle with buttons on its
 * edges reads as an object.
 *
 * Wraps the existing `PhoneFrame`/`Bubble` conversation UI unchanged —
 * this is presentation only, never a change to that shared component
 * (still real, load-bearing UI inside the authenticated product).
 */
export function DeviceFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative mx-auto aspect-[9/19.5] w-[260px] sm:w-[280px] lg:w-[300px]", className)}>
      <div className="relative h-full w-full rounded-[46px] bg-gradient-to-br from-[#4c4c54] via-[#1c1c20] via-45% to-[#050505] p-[3px] shadow-[0_2px_10px_-2px_rgba(0,0,0,0.35),0_60px_120px_-24px_rgba(15,23,42,0.55),0_30px_60px_-28px_rgba(15,23,42,0.45)]">
        {/* Edge highlight — a real object catching light, not decoration. */}
        <div className="pointer-events-none absolute inset-0 rounded-[46px] ring-1 ring-inset ring-white/10" aria-hidden />

        {/* A studio key-light catching the left edge. */}
        <div
          className="pointer-events-none absolute -left-px top-10 bottom-10 z-10 w-px rounded-full bg-gradient-to-b from-transparent via-white/45 to-transparent"
          aria-hidden
        />
        {/* A second, fainter catch along the top edge — a two-point
         * studio setup, not one flat wash. */}
        <div
          className="pointer-events-none absolute -top-px left-12 right-12 z-10 h-px rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent"
          aria-hidden
        />

        {/* Physical buttons — silhouettes only, but the single biggest
         * "this has edges, it's an object" cue a flat mockup skips. */}
        <div className="absolute -left-[2px] top-[17%] h-[6%] w-[3px] rounded-l-sm bg-gradient-to-b from-[#4a4a52] to-[#0a0a0c]" aria-hidden />
        <div className="absolute -left-[2px] top-[26%] h-[9%] w-[3px] rounded-l-sm bg-gradient-to-b from-[#4a4a52] to-[#0a0a0c]" aria-hidden />
        <div className="absolute -right-[2px] top-[21%] h-[10%] w-[3px] rounded-r-sm bg-gradient-to-b from-[#4a4a52] to-[#0a0a0c]" aria-hidden />

        {/* The screen — fixed by the chassis's own aspect ratio, never
         * by its content. Conversations scroll inside it instead. */}
        <div className="relative h-full w-full overflow-hidden rounded-[42px] bg-black">
          {children}

          {/* Dynamic-Island-style cutout, floating inside the screen on
           * top of whatever's there — not a bezel cutout. */}
          <div
            className="pointer-events-none absolute left-1/2 top-[14px] z-30 h-[22px] w-[76px] -translate-x-1/2 rounded-full bg-black ring-1 ring-inset ring-white/10"
            aria-hidden
          >
            <div className="absolute right-[14px] top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-full bg-[#16161a] ring-[0.5px] ring-white/15" aria-hidden />
          </div>

          {/* A single soft glass highlight, static — suggests a real
           * screen surface without adding a second thing that moves. */}
          <div
            className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-br from-white/[0.07] via-transparent to-transparent"
            aria-hidden
          />
          {/* A specular streak in the top-left corner — curved glass
           * catching light at one point, not an even wash across it. */}
          <div
            className="pointer-events-none absolute -left-10 -top-10 z-20 h-28 w-28 rotate-45 rounded-full bg-gradient-to-br from-white/[0.14] to-transparent blur-xl"
            aria-hidden
          />

          {/* Home indicator. */}
          <div className="pointer-events-none absolute bottom-1.5 left-1/2 z-30 h-1 w-24 -translate-x-1/2 rounded-full bg-white/25" aria-hidden />
        </div>
      </div>
    </div>
  );
}
