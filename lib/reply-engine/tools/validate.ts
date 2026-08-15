/**
 * Strict, pure argument validation for every tool — no I/O, no
 * Supabase, no LLM. A malformed or ambiguous request from the model
 * fails here, safely, before execute.ts ever touches anything real.
 * Every function returns a typed result rather than throwing: a
 * validation failure is an ordinary, expected outcome, not an
 * exception.
 */

export type ValidationResult<T> = { ok: true; args: T } | { ok: false; detail: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A provided-but-wrong-type value is a hard failure (`undefined`);
 * null/undefined/empty-string all mean "not given" and degrade to
 * `null`, never an error — the model is allowed to genuinely not know
 * a field. */
function boundedStringOrNull(value: unknown, maxLength: number): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) return undefined;
  return trimmed;
}

function isParsableDate(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(new Date(value).getTime());
}

const MIN_DURATION_MINUTES = 15;
const MAX_DURATION_MINUTES = 480;
/** A small grace window, not a hard "must be in the future" — a model
 * call assembled a second or two after the customer's own message
 * timestamp should never fail purely on clock skew. */
const PAST_GRACE_MS = 5 * 60_000;

export function validateGetCustomerContext(_raw: unknown): ValidationResult<Record<string, never>> {
  return { ok: true, args: {} };
}

export interface CreateOrUpdateJobArgs {
  issue: string | null;
  address: string | null;
  notes: string | null;
}

export function validateCreateOrUpdateJob(raw: unknown): ValidationResult<CreateOrUpdateJobArgs> {
  if (!isPlainObject(raw)) return { ok: false, detail: "arguments must be an object" };

  const issue = boundedStringOrNull(raw.issue, 200);
  if (issue === undefined) return { ok: false, detail: "issue must be a string or null" };

  const address = boundedStringOrNull(raw.address, 200);
  if (address === undefined) return { ok: false, detail: "address must be a string or null" };

  const notes = boundedStringOrNull(raw.notes, 1000);
  if (notes === undefined) return { ok: false, detail: "notes must be a string or null" };

  if (!issue && !address && !notes) return { ok: false, detail: "at least one of issue/address/notes must be provided" };

  return { ok: true, args: { issue, address, notes } };
}

export interface CheckAvailabilityArgs {
  durationMinutes: number | null;
  preferredDate: string | null;
}

export function validateCheckAvailability(raw: unknown): ValidationResult<CheckAvailabilityArgs> {
  if (!isPlainObject(raw)) return { ok: false, detail: "arguments must be an object" };

  let durationMinutes: number | null = null;
  if (raw.durationMinutes !== null && raw.durationMinutes !== undefined) {
    const n = raw.durationMinutes;
    if (typeof n !== "number" || !Number.isFinite(n) || n < MIN_DURATION_MINUTES || n > MAX_DURATION_MINUTES) {
      return { ok: false, detail: `durationMinutes must be a number between ${MIN_DURATION_MINUTES} and ${MAX_DURATION_MINUTES}` };
    }
    durationMinutes = Math.round(n);
  }

  let preferredDate: string | null = null;
  if (raw.preferredDate !== null && raw.preferredDate !== undefined) {
    if (!isParsableDate(raw.preferredDate)) return { ok: false, detail: "preferredDate must be a valid date" };
    preferredDate = raw.preferredDate;
  }

  return { ok: true, args: { durationMinutes, preferredDate } };
}

export interface CreateBookingArgs {
  start: Date;
  end: Date;
}

export function validateCreateBooking(raw: unknown, now: Date = new Date()): ValidationResult<CreateBookingArgs> {
  if (!isPlainObject(raw)) return { ok: false, detail: "arguments must be an object" };
  if (!isParsableDate(raw.start) || !isParsableDate(raw.end)) return { ok: false, detail: "start and end must be valid ISO timestamps" };

  const start = new Date(raw.start);
  const end = new Date(raw.end);
  if (end.getTime() <= start.getTime()) return { ok: false, detail: "end must be after start" };
  if (start.getTime() < now.getTime() - PAST_GRACE_MS) return { ok: false, detail: "start must not be in the past" };

  return { ok: true, args: { start, end } };
}

export interface UpdateBookingArgs {
  action: "confirm" | "cancel" | "reschedule";
  start: Date | null;
  end: Date | null;
}

export function validateUpdateBooking(raw: unknown, now: Date = new Date()): ValidationResult<UpdateBookingArgs> {
  if (!isPlainObject(raw)) return { ok: false, detail: "arguments must be an object" };
  if (raw.action !== "confirm" && raw.action !== "cancel" && raw.action !== "reschedule") {
    return { ok: false, detail: "action must be confirm, cancel, or reschedule" };
  }

  if (raw.action !== "reschedule") return { ok: true, args: { action: raw.action, start: null, end: null } };

  if (!isParsableDate(raw.start) || !isParsableDate(raw.end)) {
    return { ok: false, detail: "reschedule requires valid start and end timestamps" };
  }
  const start = new Date(raw.start);
  const end = new Date(raw.end);
  if (end.getTime() <= start.getTime()) return { ok: false, detail: "end must be after start" };
  if (start.getTime() < now.getTime() - PAST_GRACE_MS) return { ok: false, detail: "start must not be in the past" };

  return { ok: true, args: { action: "reschedule", start, end } };
}

export interface EscalateToOwnerArgs {
  reason: string;
}

export function validateEscalateToOwner(raw: unknown): ValidationResult<EscalateToOwnerArgs> {
  if (!isPlainObject(raw)) return { ok: false, detail: "arguments must be an object" };
  const reason = boundedStringOrNull(raw.reason, 300);
  if (!reason) return { ok: false, detail: "reason is required" };
  return { ok: true, args: { reason } };
}
