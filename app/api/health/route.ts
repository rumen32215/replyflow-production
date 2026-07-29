import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * Master Execution Plan 1.1 — the target for external uptime
 * monitoring (Operations Blueprint §1: "lightweight external uptime
 * monitoring against the app's health"). Deliberately public and
 * unauthenticated, the standard shape for a health check — an uptime
 * monitor has no session to authenticate with.
 *
 * Checks real DB connectivity (a cheap, real query), not just "the
 * process is running" — a database outage is exactly the kind of
 * failure that would otherwise only be discovered by a customer
 * noticing nothing works.
 */
export async function GET() {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("businesses").select("id").limit(1);
    if (error) {
      return NextResponse.json({ ok: false, error: "Database check failed." }, { status: 503 });
    }
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false, error: "Health check failed." }, { status: 503 });
  }
}
