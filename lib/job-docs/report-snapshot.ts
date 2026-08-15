import type { ReportSource } from "./report-source";

/**
 * Plumber Reset — Phase 3 step 6. `work_cards.report_snapshot` is the
 * one and only place an APPROVED report's content is frozen — a plain
 * `ReportSource` (header + jobDetails + content), written once at
 * approval time, never touched again until a new approval overwrites
 * it. Deliberately holds no photo URLs: a signed URL expires in an
 * hour, so freezing one would make the "immutable forever" snapshot
 * unusable within a day. Only `storagePath` is frozen (already part of
 * JobReportContent.photos); a fresh signed URL is resolved at render
 * time from that path, every time — the actual documented CONTENT
 * (text, which photos, in what order) never changes after approval,
 * only the transient access token needed to fetch each image's bytes.
 *
 * Defensive parsing on the way back out, same discipline as
 * understanding/state.ts's toConversationState: malformed or
 * unexpected jsonb degrades to null (render live instead) rather than
 * crashing the report page — this is an internal round-trip (we wrote
 * it, we're reading it back), so this is a structural sanity check,
 * not a full untrusted-input validator.
 */
export function parseReportSnapshot(raw: unknown): ReportSource | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!r.header || typeof r.header !== "object") return null;
  if (!r.jobDetails || typeof r.jobDetails !== "object") return null;
  if (!r.content || typeof r.content !== "object") return null;
  const content = r.content as Record<string, unknown>;
  if (!Array.isArray(content.photos) || !Array.isArray(content.observations)) return null;
  return r as unknown as ReportSource;
}
