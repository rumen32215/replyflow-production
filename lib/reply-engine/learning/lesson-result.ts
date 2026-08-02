/**
 * Defensive parsing for `proposeLesson`'s completion output, isolated
 * from the network call itself (no "server-only" import here) so the
 * exact validation logic is directly testable without mocking an LLM
 * response — matching the same convention `attachment-acknowledgment.ts`
 * and `classify.ts`'s `toUnderstandingResult` already use.
 *
 * The model's output is never trusted blindly — anything that doesn't
 * clearly validate falls back to "no lesson" rather than propagating a
 * malformed or half-formed guess downstream.
 */
export function toLessonResult(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as { has_lesson?: unknown; lesson?: unknown };
  if (data.has_lesson !== true) return null;
  if (typeof data.lesson !== "string" || !data.lesson.trim()) return null;
  return data.lesson.trim();
}
