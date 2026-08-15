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

export { BUCKET as CUSTOMER_MEDIA_BUCKET };
