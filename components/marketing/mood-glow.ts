/**
 * The four ambient lighting moods behind a phone on the Landing
 * Experience — originally Hero-only (`components/marketing/hero.tsx`),
 * promoted to a shared module (2026-08-04) so Day-in-the-Life's own
 * phone anchor can speak the identical colour language instead of
 * inventing a second palette: green = booked, blue = informational,
 * red = urgent ("used efficiently," confirmed explicitly — a touch
 * quieter than the other three, since red carries more visual alarm
 * per unit of opacity), amber = payoff. Reusing the exact same four
 * gradients across both sections is what makes the mood glow read as
 * one continuous colour language for the whole page rather than two
 * unrelated lighting systems.
 *
 * Off-centre focal point (`at 38% 30%`, an ellipse) matches the exact
 * direction `device-frame.tsx`'s own physical key-light already comes
 * from (its top-left edge highlight) — one coherent light source per
 * phone instead of a flat centred blur competing with it.
 */
export type StoryMood = "green" | "urgent" | "blue" | "amber";

export const MOOD_GLOW: Record<StoryMood, string> = {
  green: "radial-gradient(ellipse 75% 65% at 38% 30%, rgba(34,197,94,0.30), rgba(34,197,94,0.12) 55%, transparent 78%)",
  urgent: "radial-gradient(ellipse 75% 65% at 38% 30%, rgba(222,33,33,0.20), rgba(222,33,33,0.08) 55%, transparent 78%)",
  blue: "radial-gradient(ellipse 75% 65% at 38% 30%, rgba(37,99,235,0.30), rgba(37,99,235,0.12) 55%, transparent 78%)",
  amber: "radial-gradient(ellipse 75% 65% at 38% 30%, rgba(245,158,11,0.32), rgba(245,158,11,0.13) 55%, transparent 78%)",
};
