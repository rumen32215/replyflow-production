import "server-only";
import type { createServiceClient } from "@/lib/supabase/service";

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * Plumber Reset — Phase 3 step 2 (identity resolution). Root-cause fix
 * for Phase 1 Audit §3.1: a returning customer used to be found by
 * matching work_cards.customer_name against conversations.customer_name
 * — WhatsApp's own mutable profile-name field. A phone number now
 * resolves to exactly one, real `customers` row (0033/0034), the same
 * race-safe pattern lib/reply-engine/episode.ts already uses for
 * concurrent first-contact messages (insert, and on a unique-
 * constraint conflict re-fetch the row the other request just won).
 */

export interface CustomerRecord {
  id: string;
  phone: string;
  name: string | null;
  defaultAddress: string | null;
  communicationPreference: string | null;
  notes: string | null;
}

function toCustomerRecord(row: {
  id: string;
  phone: string;
  name: string | null;
  default_address: string | null;
  communication_preference: string | null;
  notes: string | null;
}): CustomerRecord {
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    defaultAddress: row.default_address,
    communicationPreference: row.communication_preference,
    notes: row.notes,
  };
}

const CUSTOMER_COLUMNS = "id, phone, name, default_address, communication_preference, notes";

async function findCustomerByPhone(supabase: ServiceClient, businessId: string, phone: string): Promise<CustomerRecord | null> {
  const { data } = await supabase.from("customers").select(CUSTOMER_COLUMNS).eq("business_id", businessId).eq("phone", phone).maybeSingle();
  return data ? toCustomerRecord(data) : null;
}

/**
 * The one entry point for turning "a phone number just messaged us"
 * into a durable identity. Idempotent and safe to call on every
 * inbound message: an existing customer's `last_contact_at` is
 * refreshed and a previously-unknown name is filled in, but an
 * existing owner-confirmed or already-learned name is never
 * overwritten by a later WhatsApp profile-name change — this only
 * ever fills a gap, never replaces a value that's already there.
 */
export async function resolveOrCreateCustomer(
  supabase: ServiceClient,
  input: { businessId: string; phone: string; name: string | null }
): Promise<CustomerRecord> {
  const existing = await findCustomerByPhone(supabase, input.businessId, input.phone);
  if (existing) {
    const patch: { last_contact_at: string; name?: string } = { last_contact_at: new Date().toISOString() };
    if (!existing.name && input.name) patch.name = input.name;
    await supabase.from("customers").update(patch).eq("id", existing.id);
    return patch.name ? { ...existing, name: patch.name } : existing;
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      business_id: input.businessId,
      phone: input.phone,
      name: input.name,
      last_contact_at: new Date().toISOString(),
    })
    .select(CUSTOMER_COLUMNS)
    .single();

  if (!error && data) return toCustomerRecord(data);

  if (error?.code === "23505") {
    const raced = await findCustomerByPhone(supabase, input.businessId, input.phone);
    if (raced) return raced;
  }

  throw new Error(`Failed to resolve or create customer: ${error?.message ?? "unknown error"}`);
}
