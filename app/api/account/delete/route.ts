import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

/**
 * Two-client pattern, same as app/api/whatsapp/connect: the session
 * client identifies *who* is asking (so this route can only ever
 * delete the caller's own account, never an id passed in the body),
 * and the service-role client does the actual deletion, since
 * deleting an auth user requires admin privileges no session has.
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const service = createServiceClient();

  // businesses -> whatsapp_connections / conversations / messages / ai_configurations
  // all cascade via "on delete cascade" foreign keys (see migrations 0001, 0003, 0004),
  // so deleting the business row is sufficient to clean up everything else.
  const { error: businessDeleteError } = await service.from("businesses").delete().eq("owner_id", user.id);
  if (businessDeleteError) {
    return NextResponse.json({ error: businessDeleteError.message }, { status: 500 });
  }

  const { error: userDeleteError } = await service.auth.admin.deleteUser(user.id);
  if (userDeleteError) {
    return NextResponse.json({ error: userDeleteError.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
