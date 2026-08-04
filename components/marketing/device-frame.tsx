"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * V9 founder review (2026-08-04): "the phone should stop feeling like
 * a demo... realistic status bar, battery, signal, Wi-Fi, current
 * time (or believable static time if live time complicates
 * implementation)." A real clock reads two different values on the
 * server and the client the instant a second ticks over between
 * render and hydration — a genuine, previously-confirmed hydration
 * hazard on this exact page (see `Hero`'s own headline/story rotation
 * notes). Apple's own product photography has used the same fixed
 * "9:41" in almost every keynote and marketing shot since the first
 * iPhone reveal for the same reason marketing shots always do this —
 * it's legible, it's calm, and nobody in the audience is checking it
 * against a real clock. That's the brief's own explicitly-offered
 * fallback, used deliberately rather than as a shortcut.
 *
 * V10 founder review (2026-08-04): "keep 9:41 — but make the battery
 * believable... never identical forever." The fill width is the only
 * thing that varies (`14 * pct/100`, same outline/position as before)
 * — at these sizes a few points of charge barely reads as different
 * at a glance, which is exactly right; the ask was that it varies,
 * not that anyone consciously clocks it. */
function StatusBar({ battery }: { battery: number }) {
  const fillWidth = (14 * Math.max(0, Math.min(100, battery))) / 100;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 pt-[7px] text-white"
      aria-hidden
    >
      <span className="text-[13px] font-semibold tabular-nums tracking-tight">9:41</span>
      <div className="flex items-center gap-[3px]">
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
          <rect x="0" y="6.5" width="2.6" height="3.5" rx="0.5" fill="white" />
          <rect x="3.8" y="4.5" width="2.6" height="5.5" rx="0.5" fill="white" />
          <rect x="7.6" y="2.5" width="2.6" height="7.5" rx="0.5" fill="white" />
          <rect x="11.4" y="0" width="2.6" height="10" rx="0.5" fill="white" />
        </svg>
        <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
          <path d="M6.5 8.6a1 1 0 100 2 1 1 0 000-2z" fill="white" />
          <path d="M3.6 6.1a4.2 4.2 0 015.8 0" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M1.1 3.6a7.6 7.6 0 0110.8 0" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <svg width="22" height="11" viewBox="0 0 22 11" fill="none">
          <rect x="0.6" y="0.6" width="18" height="9.8" rx="2.4" stroke="white" strokeOpacity="0.5" strokeWidth="1" />
          <rect x="2" y="2" width={fillWidth} height="7" rx="1.2" fill="white" />
          <rect x="19.3" y="3.5" width="1.7" height="4" rx="0.85" fill="white" fillOpacity="0.5" />
        </svg>
      </div>
    </div>
  );
}

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
 *
 * V10 founder review (2026-08-04): "mobile now feels stronger than
 * desktop... the phone shouldn't just be a scaled version of mobile."
 * The chassis was only growing 260→300px (15%) from mobile to desktop
 * while the headline beside it grows 34→52px (53%) — the phone was
 * quietly staying mobile-sized while everything around it grew,
 * which is exactly what makes a desktop hero feel like a stretched
 * phone layout instead of something designed for the canvas it's on.
 * `lg:w-[340px]` closes most of that gap; `Hero`'s own Bubble call
 * sites separately add a `lg:text-[14px]` override via `className`
 * (never touching this component's default) so the conversation text
 * itself grows with the chassis instead of floating in newly-roomier
 * padding.
 *
 * Founder review (2026-08-04): "the phone itself is still too tall,
 * especially on desktop — reduce its overall height slightly while
 * keeping readability." Width stays exactly as it was (that's what
 * fixed readability last pass); `aspect-[9/18]` (was `9/19.5`) trims
 * height alone by keeping the same real-device convention — plenty of
 * actual phones sit closer to 18:9 than the tallest 19.5:9 iPhones —
 * so it's still an honest phone proportion, just a slightly less
 * elongated one.
 */
export function DeviceFrame({
  children,
  className,
  battery = 97,
}: {
  children: React.ReactNode;
  className?: string;
  battery?: number;
}) {
  return (
    <div className={cn("relative mx-auto aspect-[9/18] w-[260px] sm:w-[280px] lg:w-[340px]", className)}>
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

          <StatusBar battery={battery} />

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
           * catching light at one point, not an even wash across it.
           * Founder review (2026-08-04): "tiny lighting shifts...
           * believable depth... the phone should feel like a real
           * device someone is holding." A held object is never
           * perfectly still under a light source — this breathes very
           * slightly (a few percent of opacity, ~6s) rather than
           * sitting static, the smallest possible version of "the
           * light is catching a surface that's alive," not an
           * animation drawing attention to itself. */}
          <motion.div
            className="pointer-events-none absolute -left-10 -top-10 z-20 h-28 w-28 rotate-45 rounded-full bg-gradient-to-br from-white/[0.14] to-transparent blur-xl"
            animate={{ opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />

          {/* Home indicator. */}
          <div className="pointer-events-none absolute bottom-1.5 left-1/2 z-30 h-1 w-24 -translate-x-1/2 rounded-full bg-white/25" aria-hidden />
        </div>
      </div>
    </div>
  );
}
