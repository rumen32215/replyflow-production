/**
 * Test Conversations (Trust Track A2/A3, `03-Trust-Experience.md` §4;
 * `DOCS/SPECS/Hiring-Experience-Redesign.md` §4) — the shared
 * convention that keeps a business's sandboxed practice conversation
 * "tagged, not stored in a parallel system" (`Trust-Track-
 * Implementation-Plan.md`): a real `conversations`/`messages` row,
 * driven through the real reply pipeline, distinguished only by using
 * the UK's reserved-for-fiction phone number range (Ofcom
 * 07700 900xxx) — the same convention `scripts/reply-engine-tests/`
 * already uses for its own adversarial suite. One fixed number, reused
 * identically across every business: the `conversations` table is
 * already scoped by `business_id`, so no per-business derivation is
 * needed to avoid collisions.
 */
export const TEST_CONVERSATION_PHONE = "447700900123";
export const TEST_CONVERSATION_NAME = "Test customer";

export function isTestConversationPhone(phone: string | null | undefined): boolean {
  return phone === TEST_CONVERSATION_PHONE;
}
