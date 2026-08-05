/**
 * The hiring conversation's timing — doc 15 §3
 * (DOCS/CONSTITUTION/15-ReplyFlow-Onboarding-Experience-Architecture.md).
 *
 * The design principle is the ordering, not these numbers:
 *   recognition < acknowledge < inference < discovery.
 * Recognising something (a tapped choice) takes no thought, so it gets
 * no pause. A simple acknowledgment takes a moment to register. A real
 * inference — a guess formed from what's been said, not looked up —
 * takes longer still. Discovery, reserved for the one moment the
 * receptionist connects two separate answers into something neither
 * said alone, gets the longest pause in the whole encounter, spent
 * nowhere else — spending it twice would empty it of meaning.
 *
 * The millisecond values below are one tuning of that ordering, safe
 * to retime without touching any call site — nothing in the component
 * should hardcode a duration inline.
 */
export const PACE = {
  recognition: 0,
  acknowledge: 750,
  inference: 1400,
  discovery: 2200,
} as const;

export type PaceBand = keyof typeof PACE;
