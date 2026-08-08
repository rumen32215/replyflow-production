import { cn } from "@/lib/utils";
import type { JobDocPhoto } from "@/hooks/use-job-doc-photos";

/**
 * ReplyFlow 2.0, Phase 2A — plain-English display states only.
 * Technical confidence values (low/medium/high) are never shown to
 * the owner, per the spec ("Never expose technical confidence values
 * to the user") — this derives one of four/five user-facing states
 * from the underlying data instead.
 */
export type PhotoDisplayState = "analysing" | "from_photos" | "possible_check" | "no_useful_detail" | "analysis_unavailable";

export function derivePhotoDisplayState(
  photo: Pick<JobDocPhoto, "analyzedAt" | "analysisErrored" | "visibleSummary" | "possibleSummary">
): PhotoDisplayState {
  if (!photo.analyzedAt) return "analysing";
  if (photo.analysisErrored) return "analysis_unavailable";
  if (photo.visibleSummary.trim()) return "from_photos";
  if (photo.possibleSummary.trim()) return "possible_check";
  return "no_useful_detail";
}

const LABEL: Record<PhotoDisplayState, string> = {
  analysing: "Analysing…",
  from_photos: "From photos",
  possible_check: "Possible — check",
  no_useful_detail: "No useful detail",
  analysis_unavailable: "Analysis couldn't be completed",
};

export function ProvenanceLabel({ state }: { state: PhotoDisplayState }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
        state === "from_photos" && "bg-accent text-primary",
        state === "possible_check" && "bg-attention/15 text-attention",
        state === "analysis_unavailable" && "bg-destructive/10 text-destructive",
        (state === "no_useful_detail" || state === "analysing") && "bg-muted text-muted-foreground"
      )}
    >
      {LABEL[state]}
    </span>
  );
}
