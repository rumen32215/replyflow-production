import { test } from "node:test";
import assert from "node:assert/strict";
import { validateJobPhotoAnalysis } from "./photo-validation";
import type { RawJobPhotoAnalysis } from "./photo-schema";

function raw(overrides: Partial<RawJobPhotoAnalysis> = {}): RawJobPhotoAnalysis {
  return {
    visibleSummary: "A radiator valve with a small amount of water pooling underneath.",
    possibleSummary: "The pooling may suggest a loose connection at the valve.",
    unknownNote: "Whether the leak has fully stopped cannot be confirmed from a photo alone.",
    confidence: "medium",
    suggestedPhase: "during",
    caption: "Radiator valve with water pooling",
    ...overrides,
  };
}

test("ordinary hedged analysis passes through unchanged and unflagged", () => {
  const result = validateJobPhotoAnalysis(raw());
  assert.equal(result.flagged, false);
  assert.ok(result.visibleSummary.length > 0);
  assert.ok(result.possibleSummary.length > 0);
});

test("a measurement/reading claim is stripped", () => {
  const result = validateJobPhotoAnalysis(raw({ visibleSummary: "The gauge reads 3.2 bar." }));
  assert.equal(result.visibleSummary, "");
  assert.equal(result.flagged, true);
});

test("a temperature claim is stripped", () => {
  const result = validateJobPhotoAnalysis(raw({ visibleSummary: "The pipe surface appears to be around 60°C." }));
  assert.equal(result.visibleSummary, "");
  assert.equal(result.flagged, true);
});

test("a claim that testing occurred is stripped", () => {
  const result = validateJobPhotoAnalysis(raw({ possibleSummary: "The system was tested and passed." }));
  assert.equal(result.possibleSummary, "");
  assert.equal(result.flagged, true);
});

test("a compliance/certification claim is stripped", () => {
  const result = validateJobPhotoAnalysis(raw({ visibleSummary: "This installation complies with BS7671." }));
  assert.equal(result.visibleSummary, "");
  assert.equal(result.flagged, true);
});

test("an EICR-style classification code is stripped", () => {
  const result = validateJobPhotoAnalysis(raw({ unknownNote: "This would likely be classified C2." }));
  assert.equal(result.unknownNote, "");
  assert.equal(result.flagged, true);
});

test("a price claim is stripped", () => {
  const result = validateJobPhotoAnalysis(raw({ caption: "Repair likely to cost £150" }));
  assert.equal(result.caption, "");
  assert.equal(result.flagged, true);
});

test("an unhedged diagnostic certainty claim is stripped", () => {
  const result = validateJobPhotoAnalysis(raw({ possibleSummary: "This valve has definitely failed." }));
  assert.equal(result.possibleSummary, "");
  assert.equal(result.flagged, true);
});

test("a danger declaration is stripped", () => {
  const result = validateJobPhotoAnalysis(raw({ unknownNote: "This wiring is dangerous." }));
  assert.equal(result.unknownNote, "");
  assert.equal(result.flagged, true);
});

test("an invented serial-number claim is stripped", () => {
  const result = validateJobPhotoAnalysis(raw({ visibleSummary: "The unit's serial number is visible on the label." }));
  assert.equal(result.visibleSummary, "");
  assert.equal(result.flagged, true);
});

test("legitimately hedged possible language is preserved, not over-blocked", () => {
  const result = validateJobPhotoAnalysis(raw({ possibleSummary: "This may indicate a worn washer, but that is not certain from the photo alone." }));
  assert.ok(result.possibleSummary.length > 0);
  assert.equal(result.flagged, false);
});

test("an empty analysis (nothing useful found) passes through as a valid, unflagged result", () => {
  const result = validateJobPhotoAnalysis(
    raw({ visibleSummary: "", possibleSummary: "", unknownNote: "The photo is too blurry to make out any detail." })
  );
  assert.equal(result.flagged, false);
  assert.equal(result.visibleSummary, "");
  assert.ok(result.unknownNote.length > 0);
});

test("only the offending field is blanked, not the whole analysis", () => {
  const result = validateJobPhotoAnalysis(raw({ possibleSummary: "Reads 240V at the terminal." }));
  assert.equal(result.possibleSummary, "");
  assert.ok(result.visibleSummary.length > 0, "an unrelated, clean field must survive");
});
