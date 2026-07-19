"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Acknowledgement, useAcknowledgement } from "@/components/shared/acknowledgement";
import { createClient } from "@/lib/supabase/client";

/**
 * Business identity — a logo (this project's first-ever Supabase
 * Storage upload) and an optional name for the receptionist. Unnamed
 * stays neutral everywhere else in the product ("your receptionist");
 * naming it here is the one place that choice gets made.
 */
export function SettingsIdentity({
  businessId,
  businessName,
  initialLogoUrl,
  initialReceptionistName,
}: {
  businessId: string;
  businessName: string;
  initialLogoUrl: string | null;
  initialReceptionistName: string | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const { message, isError, isSaving, startSaving, acknowledge, softError } = useAcknowledgement();
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [receptionistName, setReceptionistName] = useState(initialReceptionistName ?? "");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      softError();
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${businessId}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("business-assets")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (uploadError) {
        setUploading(false);
        softError();
        return;
      }
      const { data } = supabase.storage.from("business-assets").getPublicUrl(path);
      // Cache-bust so a re-upload to the same path shows immediately.
      const freshUrl = `${data.publicUrl}?v=${Date.now()}`;
      const { error: updateError } = await supabase
        .from("businesses")
        .update({ logo_url: freshUrl })
        .eq("id", businessId);
      setUploading(false);
      if (updateError) {
        softError();
        return;
      }
      setLogoUrl(freshUrl);
      acknowledge("Nice. That's how customers will see you.");
    } catch {
      setUploading(false);
      softError();
    }
  }

  /* Quiet persistence for the receptionist name — same debounced,
   * never-a-Save-button pattern as everywhere else. router.refresh()
   * (Sprint 7.5) re-runs the dashboard layout's Server Component fetch
   * so the sidebar/bottom-nav label picks up the new name immediately
   * — before this, it only updated after a full reload, since that
   * layout fetches receptionist_name once, server-side. */
  const firstRender = useRef(true);
  const requestId = useRef(0);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(async () => {
      const thisRequest = ++requestId.current;
      startSaving();
      try {
        const { error } = await supabase
          .from("businesses")
          .update({ receptionist_name: receptionistName.trim() || null })
          .eq("id", businessId);
        if (thisRequest !== requestId.current) return;
        if (error) {
          softError();
        } else {
          acknowledge(receptionistName.trim() ? `Got it — I'll go by ${receptionistName.trim()}.` : "Got it.");
          router.refresh();
        }
      } catch {
        if (thisRequest === requestId.current) softError();
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receptionistName]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          aria-label="Upload business logo"
          className="group relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full disabled:opacity-60"
        >
          <Avatar className="h-14 w-14 border border-border">
            {logoUrl && <AvatarImage src={logoUrl} alt={businessName} />}
            <AvatarFallback className="text-[15px]">{businessName.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-transparent transition-all group-hover:bg-black/40 group-hover:text-white">
            <Camera className="h-4 w-4" />
          </span>
        </button>
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold">Business logo</p>
          <p className="text-[12px] text-muted-foreground">{uploading ? "Uploading…" : "Shown throughout your dashboard"}</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleLogoSelect}
          className="hidden"
          aria-hidden
        />
      </div>

      <label className="block">
        <span className="mb-1.5 block text-[13.5px] font-semibold">What would you like to call me?</span>
        <input
          value={receptionistName}
          onChange={(e) => setReceptionistName(e.target.value)}
          placeholder="Optional — e.g. Sarah, Office, Assistant"
          className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
        />
        <p className="mt-1.5 text-[12px] text-muted-foreground">
          Leave this blank and I&apos;ll just go by &quot;your receptionist.&quot;
        </p>
      </label>

      <Acknowledgement message={message} isError={isError} isSaving={isSaving} className="text-[12.5px]" />
    </div>
  );
}
