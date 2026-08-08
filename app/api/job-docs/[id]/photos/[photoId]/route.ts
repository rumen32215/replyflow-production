import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordErrorEvent } from "@/lib/error-events";
import { deleteJobDocPhoto } from "@/lib/job-docs/photo-storage";

export const runtime = "nodejs";

const VALID_PHASES = new Set(["before", "during", "after", "other"]);

type ServiceClient = ReturnType<typeof createServiceClient>;

async function getOwnedPhoto(service: ServiceClient, jobDocId: string, photoId: string, userId: string) {
  const { data: photo } = await service
    .from("job_doc_photos")
    .select("id, job_doc_id, business_id, storage_path")
    .eq("id", photoId)
    .eq("job_doc_id", jobDocId)
    .maybeSingle();
  if (!photo) return null;
  const { data: business } = await service.from("businesses").select("id, owner_id").eq("id", photo.business_id).maybeSingle();
  if (!business || business.owner_id !== userId) return null;
  return { photo, business };
}

/**
 * Phase-chip correction and manual caption edits (ReplyFlow 2.0, Phase
 * 2A) — "the AI suggestion is never authoritative." Same
 * auth -> ownership -> service-role-write shape as every other
 * job_doc_photos write; the table still has no client insert/update
 * grant at all.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string; photoId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const service = createServiceClient();
  const owned = await getOwnedPhoto(service, params.id, params.photoId, user.id);
  if (!owned) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  let body: { phase?: string; caption?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, string | null> = {};
  if (body.phase !== undefined) {
    if (!VALID_PHASES.has(body.phase)) return NextResponse.json({ error: "Invalid phase" }, { status: 400 });
    updates.phase = body.phase;
  }
  if (body.caption !== undefined) {
    const caption = body.caption.trim().slice(0, 200);
    updates.caption = caption || null;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await service.from("job_doc_photos").update(updates).eq("id", params.photoId);
  if (error) {
    console.error("[job-docs] photo update failed:", error);
    await recordErrorEvent({
      severity: "error",
      source: "job-docs.photo_update_failed",
      businessId: owned.business.id,
      message: "Updating a job record photo failed.",
      error,
      context: { photoId: params.photoId },
    });
    return NextResponse.json({ error: "Couldn't save that change — please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string; photoId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const service = createServiceClient();
  const owned = await getOwnedPhoto(service, params.id, params.photoId, user.id);
  if (!owned) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  try {
    await deleteJobDocPhoto(service, owned.photo.storage_path);
  } catch (err) {
    // Non-fatal — still remove the row so the UI isn't stuck with a
    // reference to it. A leftover storage object with no row pointing
    // to it is a cheap, safe failure mode; the reverse (a row pointing
    // at nothing) is the one worth avoiding.
    console.error("[job-docs] photo storage delete failed (row will still be removed):", err);
  }

  const { error } = await service.from("job_doc_photos").delete().eq("id", params.photoId);
  if (error) {
    console.error("[job-docs] photo row delete failed:", error);
    await recordErrorEvent({
      severity: "error",
      source: "job-docs.photo_delete_failed",
      businessId: owned.business.id,
      message: "Deleting a job record photo failed.",
      error,
      context: { photoId: params.photoId },
    });
    return NextResponse.json({ error: "Couldn't remove that photo — please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
