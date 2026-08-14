import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AWAITING_APPROVAL_STATUS,
  APPROVED_STATUS,
  APPROVAL_INVALIDATION_UPDATE,
  needsApprovalInvalidation,
  invalidateReportApproval,
  hasApprovableContent,
  approveReport,
} from "./approval";
import type { JobReportContent } from "./report-content";

/**
 * A minimal, in-memory fake standing in for the Supabase service-role
 * client — exercises only the exact from().update().eq().eq() chain
 * invalidateReportApproval actually calls, matching the real (id,
 * status) conditional-update shape (see 0028_job_docs_approval.sql /
 * the migration's own approach). House style (lib/job-docs/draft-lock.ts)
 * otherwise keeps DB-touching code itself untested against a real
 * database — but invalidateReportApproval centralizes the actual write
 * across five call sites, so its own conditional logic (does it only
 * ever touch an 'approved' row, does it clear all three fields
 * together) gets direct, real coverage here rather than being trusted
 * on inspection alone.
 */
function fakeJobDocsClient(row: { status: string; approved_by: string | null; approved_at: string | null }) {
  return {
    from(table: string) {
      assert.equal(table, "job_docs");
      return {
        update(payload: Record<string, unknown>) {
          return {
            eq(idCol: string, _idVal: string) {
              assert.equal(idCol, "id");
              return {
                async eq(statusCol: string, statusVal: string) {
                  assert.equal(statusCol, "status");
                  if (row.status === statusVal) {
                    Object.assign(row, payload);
                  }
                  return { error: null };
                },
              };
            },
          };
        },
      };
    },
  } as any;
}

test("needsApprovalInvalidation: an approved report needs invalidation", () => {
  assert.equal(needsApprovalInvalidation("approved"), true);
});

test("needsApprovalInvalidation: draft and review never need invalidation", () => {
  assert.equal(needsApprovalInvalidation("draft"), false);
  assert.equal(needsApprovalInvalidation("review"), false);
});

test("needsApprovalInvalidation: an unrecognised status is never treated as approved", () => {
  assert.equal(needsApprovalInvalidation("signed"), false);
  assert.equal(needsApprovalInvalidation("exported"), false);
});

test("(d) APPROVAL_INVALIDATION_UPDATE always clears status/approved_by/approved_at together, as one object", () => {
  assert.deepEqual(APPROVAL_INVALIDATION_UPDATE, {
    status: AWAITING_APPROVAL_STATUS,
    approved_by: null,
    approved_at: null,
  });
});

test("(a) approved report + report-visible mutation -> approval cleared", async () => {
  const row = { status: "approved", approved_by: "user-1", approved_at: "2026-08-01T00:00:00.000Z" };
  await invalidateReportApproval(fakeJobDocsClient(row), "job-1");
  assert.equal(row.status, "review");
  assert.equal(row.approved_by, null);
  assert.equal(row.approved_at, null);
});

test("(c) an already-'review' report is left exactly as it was — invalidation is a real no-op, not a fabricated transition", async () => {
  const row = { status: "review", approved_by: null, approved_at: null };
  await invalidateReportApproval(fakeJobDocsClient(row), "job-2");
  assert.equal(row.status, "review");
  assert.equal(row.approved_by, null);
  assert.equal(row.approved_at, null);
});

test("(c) a 'draft' report is left exactly as it was, never bumped forward to review", async () => {
  const row = { status: "draft", approved_by: null, approved_at: null };
  await invalidateReportApproval(fakeJobDocsClient(row), "job-3");
  assert.equal(row.status, "draft");
});

test("(d) approval fields are cleared together — never left half-cleared", async () => {
  const row = { status: "approved", approved_by: "user-2", approved_at: "2026-08-05T09:30:00.000Z" };
  await invalidateReportApproval(fakeJobDocsClient(row), "job-4");
  const bothCleared = row.approved_by === null && row.approved_at === null;
  assert.equal(bothCleared, true);
  assert.equal(row.status, AWAITING_APPROVAL_STATUS);
});

function emptyContent(overrides: Partial<JobReportContent> = {}): JobReportContent {
  return {
    jobDocId: "job-1",
    isJobCompleted: false,
    issueReported: null,
    jobSummary: null,
    workPerformed: null,
    nextSteps: null,
    observations: [],
    photos: [],
    ...overrides,
  };
}

test("hasApprovableContent: a job summary alone is enough", () => {
  assert.equal(hasApprovableContent(emptyContent({ jobSummary: { text: "Repaired a leak.", provenance: "user_fact" } })), true);
});

test("hasApprovableContent: work performed alone is enough", () => {
  assert.equal(hasApprovableContent(emptyContent({ workPerformed: { text: "Replaced the valve.", provenance: "ai_structured" } })), true);
});

test("hasApprovableContent: an observation alone is enough", () => {
  assert.equal(hasApprovableContent(emptyContent({ observations: [{ text: "No further leaks found.", provenance: "user_fact" }] })), true);
});

test("hasApprovableContent: a photo alone is enough", () => {
  const photo = {
    id: "p1",
    storagePath: "b/j/p1.jpg",
    caption: null,
    phase: "before" as const,
    visibleSummary: "",
    possibleSummary: "",
    unknownNote: "",
    confidence: "low" as const,
    analyzed: true,
  };
  assert.equal(hasApprovableContent(emptyContent({ photos: [photo] })), true);
});

test("hasApprovableContent: completely empty content is not approvable", () => {
  assert.equal(hasApprovableContent(emptyContent()), false);
});

/**
 * A minimal in-memory fake for approveReport's own from().update().eq()
 * .eq().select().maybeSingle() chain — the (id, status) conditional
 * write shape mirrors invalidateReportApproval's exactly, just the
 * reverse transition, with a real return value the route needs to
 * know whether the approval actually happened.
 */
function fakeJobDocsClientForApproval(row: { status: string; approved_by: string | null; approved_at: string | null }, id = "job-1") {
  return {
    from(table: string) {
      assert.equal(table, "job_docs");
      return {
        update(payload: Record<string, unknown>) {
          return {
            eq(idCol: string, idVal: string) {
              assert.equal(idCol, "id");
              return {
                eq(statusCol: string, statusVal: string) {
                  assert.equal(statusCol, "status");
                  const matches = idVal === id && row.status === statusVal;
                  if (matches) Object.assign(row, payload);
                  return {
                    select(cols: string) {
                      assert.equal(cols, "id");
                      return {
                        async maybeSingle() {
                          return { data: matches ? { id } : null, error: null };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  } as any;
}

test("approveReport: a 'review' report is approved — status/approved_by/approved_at all set together", async () => {
  const row = { status: "review", approved_by: null, approved_at: null };
  const result = await approveReport(fakeJobDocsClientForApproval(row), "job-1", "user-1");
  assert.equal(result.approved, true);
  assert.equal(row.status, APPROVED_STATUS);
  assert.equal(row.approved_by, "user-1");
  assert.equal(typeof row.approved_at, "string");
  assert.equal(result.approvedAt, row.approved_at);
});

test("approveReport: an already-'approved' report is not re-approved (no-op, approved: false)", async () => {
  const row = { status: "approved", approved_by: "user-1", approved_at: "2026-08-01T00:00:00.000Z" };
  const result = await approveReport(fakeJobDocsClientForApproval(row), "job-1", "user-2");
  assert.equal(result.approved, false);
  assert.equal(result.approvedAt, null);
  // Untouched — never overwritten by a second approver.
  assert.equal(row.approved_by, "user-1");
  assert.equal(row.approved_at, "2026-08-01T00:00:00.000Z");
});

test("approveReport: a 'draft' report cannot be approved", async () => {
  const row = { status: "draft", approved_by: null, approved_at: null };
  const result = await approveReport(fakeJobDocsClientForApproval(row), "job-1", "user-1");
  assert.equal(result.approved, false);
  assert.equal(row.status, "draft");
});

test("approveReport: a database error is thrown, not swallowed", async () => {
  const failingClient = {
    from() {
      return {
        update() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    select() {
                      return { maybeSingle: async () => ({ data: null, error: new Error("connection lost") }) };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  } as any;
  await assert.rejects(() => approveReport(failingClient, "job-1", "user-1"), /connection lost/);
});

test("a database error is thrown, not swallowed", async () => {
  const failingClient = {
    from() {
      return {
        update() {
          return {
            eq() {
              return {
                eq: async () => ({ error: new Error("connection lost") }),
              };
            },
          };
        },
      };
    },
  } as any;
  await assert.rejects(() => invalidateReportApproval(failingClient, "job-5"), /connection lost/);
});
