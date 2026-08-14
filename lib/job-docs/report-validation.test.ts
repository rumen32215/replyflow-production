import { test } from "node:test";
import assert from "node:assert/strict";
import { validateJobReportDraft } from "./report-validation";
import type { JobReportDraft } from "./generate-draft";

function draft(overrides: Partial<JobReportDraft> = {}): JobReportDraft {
  return {
    jobSummary: { text: "Repaired a leaking radiator valve at the customer's property.", confidence: "high" },
    workPerformed: { text: "Replaced the valve and tested the heating system afterwards.", confidence: "high" },
    nextSteps: { text: "No further action needed.", confidence: "medium" },
    observations: [
      { text: "The old valve showed signs of wear.", confidence: "medium" },
      { text: "No further leaks were found after the repair.", confidence: "high" },
    ],
    divergenceNote: "",
    ...overrides,
  };
}

test("an ordinary hedged draft passes through unchanged and unflagged", () => {
  const result = validateJobReportDraft(draft());
  assert.equal(result.flagged, false);
  assert.equal(result.jobSummary.text, draft().jobSummary.text);
  assert.equal(result.workPerformed.text, draft().workPerformed.text);
  assert.equal(result.observations.length, 2);
});

test("a measurement/reading claim in job_summary is stripped", () => {
  const result = validateJobReportDraft(draft({ jobSummary: { text: "The gauge read 3.2 bar on arrival.", confidence: "high" } }));
  assert.equal(result.jobSummary.text, "");
  assert.equal(result.flagged, true);
});

test("a compliance/certification claim in work_performed is stripped", () => {
  const result = validateJobReportDraft(
    draft({ workPerformed: { text: "The finished installation complies with BS7671.", confidence: "high" } })
  );
  assert.equal(result.workPerformed.text, "");
  assert.equal(result.flagged, true);
});

test("a price claim in one observation is stripped, the other observation survives", () => {
  const result = validateJobReportDraft(
    draft({
      observations: [
        { text: "Repair likely to cost £150.", confidence: "medium" },
        { text: "The old valve showed signs of wear.", confidence: "medium" },
      ],
    })
  );
  assert.equal(result.observations[0]?.text, "");
  assert.equal(result.observations[1]?.text, "The old valve showed signs of wear.");
  assert.equal(result.flagged, true);
});

test("an unhedged diagnostic certainty claim in work_performed is stripped", () => {
  const result = validateJobReportDraft(draft({ workPerformed: { text: "The old valve has definitely failed.", confidence: "high" } }));
  assert.equal(result.workPerformed.text, "");
  assert.equal(result.flagged, true);
});

test("a danger declaration in an observation is stripped", () => {
  const result = validateJobReportDraft(draft({ observations: [{ text: "The old wiring is dangerous.", confidence: "medium" }] }));
  assert.equal(result.observations[0]?.text, "");
  assert.equal(result.flagged, true);
});

test("an invented serial-number claim is stripped", () => {
  const result = validateJobReportDraft(
    draft({ jobSummary: { text: "The unit's serial number is visible on the label.", confidence: "high" } })
  );
  assert.equal(result.jobSummary.text, "");
  assert.equal(result.flagged, true);
});

test("only the offending field is blanked, not the whole draft", () => {
  const result = validateJobReportDraft(draft({ workPerformed: { text: "Reads 240V at the terminal.", confidence: "high" } }));
  assert.equal(result.workPerformed.text, "");
  assert.ok(result.jobSummary.text.length > 0, "an unrelated, clean field must survive");
  assert.equal(result.observations.length, 2, "unrelated observations must survive");
});

test("a banned pattern inside divergence_note is stripped", () => {
  const result = validateJobReportDraft(draft({ divergenceNote: "The notes say the part was replaced, which cost £80." }));
  assert.equal(result.divergenceNote, "");
  assert.equal(result.flagged, true);
});

test("empty fields (nothing genuinely supported by the notes) pass through as valid and unflagged", () => {
  const result = validateJobReportDraft(draft({ jobSummary: { text: "", confidence: "low" }, observations: [] }));
  assert.equal(result.flagged, false);
  assert.equal(result.jobSummary.text, "");
  assert.equal(result.observations.length, 0);
});

test("a banned pattern in next_steps is stripped, same as any other field (production hardening, 2026-08-14)", () => {
  const result = validateJobReportDraft(draft({ nextSteps: { text: "A follow-up visit will cost £45.", confidence: "medium" } }));
  assert.equal(result.nextSteps.text, "");
  assert.equal(result.flagged, true);
});

test("legitimately hedged, clean language is preserved, not over-blocked", () => {
  const result = validateJobReportDraft(
    draft({ workPerformed: { text: "The leak may have been caused by a worn washer, though this could not be fully confirmed.", confidence: "medium" } })
  );
  assert.ok(result.workPerformed.text.length > 0);
  assert.equal(result.flagged, false);
});
