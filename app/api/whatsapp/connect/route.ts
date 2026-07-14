import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { exchangeCodeForToken, getPhoneNumberDetails, subscribeAppToWaba } from "@/lib/whatsapp/graph";

export const runtime = "nodejs";

/**
 * Finishes the Embedded Signup flow. The browser only ever sends us the
 * authorization `code` plus the waba_id/phone_number_id the SDK reported
 * — we treat those IDs as untrusted and confirm the phone number
 * directly with Meta before storing anything.
 *
 * Onboarding no longer collects business details up front (see the
 * Screen 1/2/3 redesign — business name/phone/hours moved to guided
 * setup tasks inside the dashboard). That means a `businesses` row may
 * not exist yet the first time this route runs. Rather than requiring
 * onboarding to create one first, this route creates a minimal one on
 * the fly if missing — using the real WhatsApp number Meta just
 * returned as the business phone, so the user is never asked to type
 * one. This also marks onboarding complete: with setup moved to the
 * dashboard, "onboarded" now means "WhatsApp is connected," not
 * "every field is filled in."
 */
export async function POST(request: Request) {
  const { code, wabaId, phoneNumberId } = (await request.json().catch(() => ({}))) as {
    code?: string;
    wabaId?: string;
    phoneNumberId?: string;
  };

  if (!code || !wabaId || !phoneNumberId) {
    return NextResponse.json({ error: "Missing code, wabaId, or phoneNumberId" }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const tokenResponse = await exchangeCodeForToken(code);
    const phoneDetails = await getPhoneNumberDetails(phoneNumberId, tokenResponse.access_token);
    await subscribeAppToWaba(wabaId, tokenResponse.access_token);

    const service = createServiceClient();

    let { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).maybeSingle();

    if (!business) {
      const placeholderName = user.email ? `${user.email.split("@")[0]}'s Business` : "My Business";
      const { data: created, error: createError } = await service
        .from("businesses")
        .insert({ owner_id: user.id, business_name: placeholderName, phone: phoneDetails.display_phone_number })
        .select("id")
        .single();
      if (createError) throw createError;
      business = created;
    }

    if (!business) {
      throw new Error("Failed to create business record");
    }

    const { error: upsertError } = await service.from("whatsapp_connections").upsert(
      {
        business_id: business.id,
        waba_id: wabaId,
        phone_number_id: phoneNumberId,
        display_phone_number: phoneDetails.display_phone_number,
        access_token: tokenResponse.access_token,
        token_expires_at: tokenResponse.expires_in
          ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
          : null,
        webhook_verified: true,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "business_id" }
    );
    if (upsertError) throw upsertError;

    const { error: businessUpdateError } = await service
      .from("businesses")
      .update({ whatsapp_connected: true, onboarding_completed: true })
      .eq("id", business.id);
    if (businessUpdateError) throw businessUpdateError;

    return NextResponse.json({ connected: true, displayPhoneNumber: phoneDetails.display_phone_number });
  } catch (err) {
    console.error("[whatsapp connect] failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
