"use client";

import { useState } from "react";
import { Camera, AlertTriangle } from "lucide-react";
import { useJobDocPhotos, type JobDocPhoto } from "@/hooks/use-job-doc-photos";
import { PhotoUploader } from "./photo-uploader";
import { PhotoCard } from "./photo-card";

const MAX_PHOTOS = 20;

/**
 * ReplyFlow 2.0, Phase 2A — photos live directly inside the existing
 * Job Record, between Original Notes and the Job Report; there is no
 * separate photo product or workflow. Live status comes from the
 * bounded-polling hook, not Supabase Realtime.
 */
export function PhotoSection({ jobDocId, initialPhotos }: { jobDocId: string; initialPhotos: JobDocPhoto[] }) {
  const { photos, setPhotos, refresh } = useJobDocPhotos(jobDocId, initialPhotos);
  const [uploadStatus, setUploadStatus] = useState<{ uploading: boolean; done: number; total: number }>({
    uploading: false,
    done: 0,
    total: 0,
  });

  function handlePhotoChanged(id: string, updated: Partial<JobDocPhoto>) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
  }

  function handlePhotoRemoved(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  // A failed photo must never silently disappear from the record —
  // this stays visible for as long as the photo remains unretried,
  // independent of the separate, generate-time notice
  // (job-report-draft.tsx) that fires specifically when Generate
  // Draft is pressed.
  const erroredCount = photos.filter((p) => p.analysisErrored).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground">Photos</h2>
        <PhotoUploader
          jobDocId={jobDocId}
          currentCount={photos.length}
          maxPhotos={MAX_PHOTOS}
          onUploaded={refresh}
          onProgress={(uploading, done, total) => setUploadStatus({ uploading, done, total })}
        />
      </div>

      {uploadStatus.uploading && (
        <p className="text-[12.5px] text-muted-foreground">
          Uploading {uploadStatus.done} of {uploadStatus.total}…
        </p>
      )}

      {erroredCount > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-destructive/20 bg-destructive/[0.05] px-3.5 py-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
          <p className="text-[12.5px] text-foreground">
            {erroredCount} photo{erroredCount === 1 ? "" : "s"} couldn&apos;t be analysed — retry below, or continue without{" "}
            {erroredCount === 1 ? "it" : "them"}.
          </p>
        </div>
      )}

      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">+ Add photos</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Take photos of the job — before, during, after. Up to 20 photos, private.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo) => (
            <PhotoCard
              key={photo.id}
              jobDocId={jobDocId}
              photo={photo}
              onChanged={(updated) => handlePhotoChanged(photo.id, updated)}
              onRemoved={() => handlePhotoRemoved(photo.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
