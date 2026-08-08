import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { JobRecordIntakeForm } from "@/components/dashboard/job-records/job-record-intake-form";

export const metadata: Metadata = { title: "New Job Record — ReplyFlow" };

export default async function NewJobRecordPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).maybeSingle();
  if (!business) redirect("/onboarding/preparing");

  return (
    <div className="mx-auto max-w-[720px] space-y-6">
      <div>
        <Link href="/dashboard/job-records" className="inline-flex items-center gap-1 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" />
          Job Records
        </Link>
        <h1 className="mt-2 text-xl font-bold tracking-tight">New Job Record</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">Enter the basics, then I&apos;ll draft the report from your notes.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <JobRecordIntakeForm />
      </div>
    </div>
  );
}
