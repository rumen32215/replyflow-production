"use client";

import { useState } from "react";
import { Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { JobDocPhoto } from "@/hooks/use-job-doc-photos";
import { ProvenanceLabel, derivePhotoDisplayState } from "./provenance-label";

const PHASE_CYCLE = ["before", "during", "after", "other"] as const;
const PHASE_LABEL: Record<(typeof PHASE_CYCLE)[number], string> = {
  before: "Before",
  during: "During",
  after: "After",
  other: "Other",
};

/**
 * ReplyFlow 2.0, Phase 2A — one photo, reviewable without ever forcing
 * capture-time typing. The phase chip is tap-to-cycle, never a
 * dropdown or a required field — "the AI suggestion is never
 * authoritative," it's just wherever the chip starts.
 */
export function PhotoCard({
  jobDocId,
  photo,
  onChanged,
  onRemoved,
}: {
  jobDocId: string;
  photo: JobDocPhoto;
  onChanged: (updated: Partial<JobDocPhoto>) => void;
  onRemoved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const state = derivePhotoDisplayState(photo);

  async function cyclePhase() {
    if (busy) return;
    const nextIndex = (PHASE_CYCLE.indexOf(photo.phase) + 1) % PHASE_CYCLE.length;
    const nextPhase = PHASE_CYCLE[nextIndex];
    const previousPhase = photo.phase;
    onChanged({ phase: nextPhase });
    try {
      const res = await fetch(`/api/job-docs/${jobDocId}/photos/${photo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: nextPhase }),
      });
      if (!res.ok) throw new Error();
    } catch {
      onChanged({ phase: previousPhase });
      toast({ variant: "destructive", title: "Couldn't update that photo's stage" });
    }
  }

  async function retry() {
    if (retrying) return;
    setRetrying(true);
    // Optimistic — mirrors what the server just set (analyzed_at back
    // to null), so this card immediately reads "Analysing…" and the
    // existing bounded-polling hook (which already polls whenever any
    // photo is pending) picks it up with no new client logic.
    onChanged({ analyzedAt: null, analysisErrored: false });
    try {
      const res = await fetch(`/api/job-docs/${jobDocId}/photos/${photo.id}/retry`, { method: "POST" });
      if (!res.ok) throw new Error();
    } catch {
      onChanged({ analyzedAt: photo.analyzedAt, analysisErrored: true });
      toast({ variant: "destructive", title: "Couldn't retry that photo's analysis" });
    } finally {
      setRetrying(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/job-docs/${jobDocId}/photos/${photo.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onRemoved();
    } catch {
      toast({ variant: "destructive", title: "Couldn't remove that photo" });
      setBusy(false);
    }
  }

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative aspect-square bg-muted">
        {photo.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- a per-job-record signed URL, not an optimizable static asset
          <img src={photo.url} alt={photo.caption ?? "Job photo"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          aria-label="Remove photo"
          className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={cyclePhase}
          className="absolute bottom-1.5 left-1.5 flex min-h-[32px] items-center rounded-full bg-background/90 px-3 text-[11.5px] font-semibold text-foreground shadow-sm"
        >
          {PHASE_LABEL[photo.phase]}
        </button>
      </div>
      <div className="space-y-1.5 p-2.5">
        <ProvenanceLabel state={state} />
        {state === "analysis_unavailable" ? (
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="flex min-h-[28px] items-center gap-1.5 text-[12px] font-semibold text-primary disabled:opacity-50"
          >
            {retrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Retry analysis
          </button>
        ) : (
          photo.caption && <p className="truncate text-[12px] text-muted-foreground">{photo.caption}</p>
        )}
      </div>
    </div>
  );
}
