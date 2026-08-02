import "server-only";
import { getCompletion } from "../llm/client";
import { recordErrorEvent } from "@/lib/error-events";
import { toLessonResult } from "./lesson-result";

/**
 * Learning Memory's one deliberate exception to "no new AI calls"
 * (`DOCS/CONSTITUTION/12-ReplyFlow-Learning-Memory-Architecture.md`
 * §2.2) — translating an edit's wording into the business fact it
 * reveals genuinely requires interpretation a template can't do. What
 * keeps this safe is everything downstream of it, not this call
 * itself: the result is always a hedged hypothesis, never written
 * anywhere durable until the owner explicitly confirms or clarifies it
 * (see `app/api/learning-proposals/[id]/route.ts`).
 *
 * Deliberately the smallest possible context: the two draft texts and
 * the real customer message they were both replying to — the same
 * fact-grounding discipline `generateReplyDraft` already applies,
 * never the full conversation history.
 */

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    has_lesson: { type: "boolean" },
    lesson: { type: ["string", "null"] },
  },
  required: ["has_lesson", "lesson"],
} as const;

const SYSTEM_PROMPT = `You compare an AI-drafted WhatsApp reply from a UK trade/service business against the owner's own edited version of the same reply, and decide whether the edit reveals a real, durable business fact worth remembering — never just a change in wording or tone.

A REAL LESSON is something like: a price, fee, or policy the draft got wrong; a service the business does or doesn't actually offer; a rule about how or when they work; a fact about availability or process. The kind of thing that would still be true and still matter the next time a different customer asks something similar.

NOT a lesson: a tone change (friendlier, more formal, shorter); a wording preference; fixing a typo; a one-off situational exception for this specific customer that wouldn't apply generally; anything you cannot point to a specific difference in the two texts to support.

If you find a real lesson: set has_lesson to true, and write ONE short sentence stating it as your own best guess, not a fact — always begin with clear uncertainty ("I think...", "It looks like...", "It sounds like..."). Never state it as something you now know for certain. Never invent a detail that isn't actually evidenced by the difference between the two replies.

If you are not confident there is a real, durable business lesson here: set has_lesson to false and lesson to null. When genuinely unsure, prefer false — a missed lesson costs nothing; a wrong guess costs the owner's trust.`;

export interface ProposeLessonInput {
  businessId: string;
  category: string;
  customerMessage: string;
  originalDraft: string;
  editedDraft: string;
}

/** null = no confident lesson found (including on any failure —
 * degrades to "nothing proposed," never a guess forced through). */
export async function proposeLesson(input: ProposeLessonInput): Promise<string | null> {
  try {
    const userContent = `Category: ${input.category}\n\nCustomer's message: "${input.customerMessage}"\n\nOriginal drafted reply: "${input.originalDraft}"\n\nThe owner's edited reply: "${input.editedDraft}"`;

    const result = await getCompletion({
      tier: "small",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      jsonSchema: { name: "learning_lesson_proposal", schema: RESPONSE_SCHEMA },
      maxOutputTokens: 200,
      businessId: input.businessId,
      callSite: "learning.propose_lesson",
    });

    return toLessonResult(result.data);
  } catch (err) {
    console.error("[learning] proposeLesson failed:", err);
    await recordErrorEvent({
      severity: "warning",
      source: "learning.propose_failed",
      businessId: input.businessId,
      message: "proposeLesson's completion call failed — no learning proposal was created for this edit.",
      error: err,
    });
    return null;
  }
}
