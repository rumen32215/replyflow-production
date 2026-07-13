import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function POST() {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return NextResponse.json(
        { step: "getUser", error: userError.message },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { step: "auth", error: "Not authenticated" },
        { status: 401 }
      );
    }

    const service = createServiceClient();

    const { error: businessDeleteError } = await service
      .from("businesses")
      .delete()
      .eq("owner_id", user.id);

    if (businessDeleteError) {
      return NextResponse.json(
        { step: "deleteBusiness", error: businessDeleteError.message },
        { status: 500 }
      );
    }

    const { error: userDeleteError } =
      await service.auth.admin.deleteUser(user.id);

    if (userDeleteError) {
      return NextResponse.json(
        { step: "deleteUser", error: userDeleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      {
        step: "catch",
        error: e?.message,
        stack: e?.stack,
      },
      { status: 500 }
    );
  }
}