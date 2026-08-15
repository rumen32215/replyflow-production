"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_CONCURRENT = 3;

/**
 * ReplyFlow 2.0, Phase 2A — "+ Add photos." Deliberately no `capture`
 * attribute on the file input: on iOS/Android, a plain
 * `accept="image/*"` input already opens the native OS sheet with
 * both "Take Photo" and "Choose from Library" — adding `capture`
 * forces camera-only and removes the library option, which the spec
 * explicitly wants available. One POST per file (not a batch upload)
 * so each photo can fail and retry independently; this component runs
 * up to 3 of those concurrently.
 */
export function PhotoUploader({
  jobDocId,
  currentCount,
  maxPhotos,
  onUploaded,
  onProgress,
}: {
  jobDocId: string;
  currentCount: number;
  maxPhotos: number;
  onUploaded: () => void;
  onProgress: (uploading: boolean, doneCount: number, totalCount: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [disabled, setDisabled] = useState(false);
  const remaining = maxPhotos - currentCount;

  async function uploadOne(file: File): Promise<void> {
    const form = new FormData();
    form.append("photo", file);
    try {
      const res = await fetch(`/api/job-docs/${jobDocId}/photos`, { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast({ variant: "destructive", title: `Couldn't upload ${file.name}`, description: data?.error });
        return;
      }
      onUploaded();
    } catch {
      toast({ variant: "destructive", title: `Couldn't upload ${file.name}` });
    }
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const requested = Array.from(fileList);
    const files = requested.slice(0, Math.max(remaining, 0));
    if (files.length < requested.length) {
      toast({ title: `Only ${remaining} more photo${remaining === 1 ? "" : "s"} can be added — the limit is ${maxPhotos}.` });
    }

    const valid: File[] = [];
    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) {
        toast({ variant: "destructive", title: `${file.name} isn't a supported photo type` });
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast({ variant: "destructive", title: `${file.name} is larger than 10MB` });
        continue;
      }
      valid.push(file);
    }
    if (valid.length === 0) return;

    setDisabled(true);
    let done = 0;
    onProgress(true, 0, valid.length);

    let index = 0;
    async function worker() {
      while (index < valid.length) {
        const file = valid[index++];
        if (!file) continue;
        await uploadOne(file);
        done += 1;
        onProgress(true, done, valid.length);
      }
    }
    await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT, valid.length) }, worker));

    onProgress(false, done, valid.length);
    setDisabled(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (remaining <= 0) {
    return <p className="text-[12.5px] text-muted-foreground">You&apos;ve reached the 20-photo limit for this job record.</p>;
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
        id={`photo-upload-${jobDocId}`}
      />
      <label
        htmlFor={`photo-upload-${jobDocId}`}
        className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-[13.5px] font-semibold hover:bg-muted ${
          disabled ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <Camera className="h-4 w-4" />
        + Add photos
      </label>
      {currentCount >= 15 && (
        <span className="text-[12px] text-muted-foreground">
          {currentCount} of {maxPhotos}
        </span>
      )}
    </div>
  );
}
