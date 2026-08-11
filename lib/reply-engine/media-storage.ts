import "server-only";
import type { createServiceClient } from "@/lib/supabase/service";

type ServiceClient = ReturnType<typeof createServiceClient>;

/** Private bucket, created by supabase/migrations/0024_customer_photos.sql
 * (public: false, no RLS policy granted to `authenticated`) — the
 * service role is the only writer and the only reader; the dashboard
 * gets in only via a server-generated signed URL, after the requesting
 * owner's own RLS-scoped conversation lookup already proved ownership
 * (see app/(dashboard)/dashboard/conversations/[id]/page.tsx). */
const BUCKET = "customer-media";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Stores one customer-submitted photo, scoped by business and
 * conversation so the path itself carries no ambiguity about whose
 * data it is — keyed by message id (unique per message) so re-processing
 * the same message (a webhook redelivery) overwrites rather than
 * accumulating duplicates.
 */
export async function storeCustomerMedia(
  supabase: ServiceClient,
  input: { businessId: string; conversationId: string; messageId: string; bytes: Uint8Array; mimeType: string }
): Promise<string> {
  const extension = EXTENSION_BY_MIME[input.mimeType] ?? "bin";
  const path = `${input.businessId}/${input.conversationId}/${input.messageId}.${extension}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, input.bytes, {
    contentType: input.mimeType,
    upsert: true,
  });
  if (error) throw new Error(`Failed to store customer media: ${error.message}`);

  return path;
}

/**
 * Re-reads an already-stored customer photo's bytes. Added for the
 * Work Card → Job Record link (0030): generating a report copies a
 * job's already-analysed WhatsApp photos into job-doc-media rather
 * than asking the owner to re-upload something ReplyFlow already has.
 * Mirrors lib/job-docs/photo-storage.ts's downloadJobDocPhoto exactly.
 */
export async function downloadCustomerMedia(
  supabase: ServiceClient,
  storagePath: string
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error || !data) throw new Error(`Failed to download customer media: ${error?.message ?? "no data returned"}`);
  const arrayBuffer = await data.arrayBuffer();
  return { bytes: new Uint8Array(arrayBuffer), mimeType: data.type || "image/jpeg" };
}

export { BUCKET as CUSTOMER_MEDIA_BUCKET };
