"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface JobDocPhoto {
  id: string;
  url: string | null;
  caption: string | null;
  phase: "before" | "during" | "after" | "other";
  sortOrder: number;
  visibleSummary: string;
  possibleSummary: string;
  unknownNote: string;
  analysisErrored: boolean;
  confidence: "low" | "medium" | "high";
  analyzedAt: string | null;
}

const POLL_INTERVAL_MS = 4000;
// Production hardening (2026-08-14) — 60s was shorter than the Job
// Record's own photo analysis (lib/job-docs/analysis.ts) can genuinely
// take: a longer safety-boundary check than the WhatsApp photo
// analyzer, on top of normal vision-call latency and any cold start.
// When analysis ran past 60s, polling stopped while the photo was
// still genuinely mid-analysis — a manual refresh (which resets this
// budget) was the only thing that ever caught the real result. Still
// bounded, just realistic for this pipeline specifically.
const POLL_BUDGET_MS = 180000;

async function fetchJobDocPhotos(jobDocId: string): Promise<JobDocPhoto[] | null> {
  try {
    const res = await fetch(`/api/job-docs/${jobDocId}/photos`);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.photos) ? data.photos : [];
  } catch {
    return null;
  }
}

/**
 * Bounded client-side polling (ReplyFlow 2.0, Phase 2A — no Supabase
 * Realtime, per the approved spec). Polls only while at least one
 * photo is still pending (analyzedAt === null); pauses while the tab
 * is hidden rather than burning requests in the background; always
 * stops at a hard 60-second budget from first mount, regardless of
 * how many pause/resume cycles happen in between — "bounded" means
 * bounded across visibility changes, not reset by them.
 */
export function useJobDocPhotos(jobDocId: string, initialPhotos: JobDocPhoto[]) {
  const [photos, setPhotos] = useState<JobDocPhoto[]>(initialPhotos);
  const deadlineRef = useRef<number>(Date.now() + POLL_BUDGET_MS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const fresh = await fetchJobDocPhotos(jobDocId);
    if (fresh) setPhotos(fresh);
    return fresh;
  }, [jobDocId]);

  // A genuinely new job doc (navigating between records) resets the
  // budget; re-rendering with the same jobDocId never does.
  useEffect(() => {
    deadlineRef.current = Date.now() + POLL_BUDGET_MS;
  }, [jobDocId]);

  useEffect(() => {
    const hasPending = photos.some((p) => !p.analyzedAt);

    function stop() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    function tick() {
      if (document.hidden) return; // pause while hidden — no wasted requests
      if (Date.now() >= deadlineRef.current) {
        stop();
        return;
      }
      refresh();
    }

    if (!hasPending) {
      stop();
      return;
    }

    intervalRef.current = setInterval(tick, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", tick);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, refresh]);

  return { photos, setPhotos, refresh };
}

/**
 * Used by the Generate Draft action (job-report-draft.tsx): if photos
 * are still analysing when the owner presses Generate, wait for them
 * to settle, up to the same 60-second budget, then proceed regardless
 * — Generate Draft must never hang indefinitely on a slow photo.
 */
export async function waitForJobDocPhotosSettled(jobDocId: string, budgetMs = POLL_BUDGET_MS): Promise<JobDocPhoto[]> {
  const deadline = Date.now() + budgetMs;
  let photos = (await fetchJobDocPhotos(jobDocId)) ?? [];
  while (photos.some((p) => !p.analyzedAt) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    photos = (await fetchJobDocPhotos(jobDocId)) ?? photos;
  }
  return photos;
}
