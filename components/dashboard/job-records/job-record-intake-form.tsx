"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

/**
 * ReplyFlow 2.0, Phase 2 — "Enter information," step one of the
 * vertical slice. A real server route (app/api/job-docs/route.ts)
 * does the actual writes — job_doc_fields (where the raw notes land)
 * has no client-side write path, so this can't be a direct Supabase
 * insert the way the old title-only quick-add was.
 */
export function JobRecordIntakeForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [jobAddress, setJobAddress] = useState("");
  const [jobDate, setJobDate] = useState("");
  const [rawNotes, setRawNotes] = useState("");

  async function submit() {
    if (saving || !rawNotes.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/job-docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName, customerPhone, customerEmail, jobAddress, jobDate, rawNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Something went wrong.");
      router.push(`/dashboard/job-records/${data.id}`);
    } catch (err) {
      toast({ variant: "destructive", title: "Couldn't create this job record", description: err instanceof Error ? err.message : undefined });
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="customerName">Customer name</Label>
          <Input id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} disabled={saving} placeholder="e.g. Sarah Higgins" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="jobAddress">Job / property address</Label>
          <Input id="jobAddress" value={jobAddress} onChange={(e) => setJobAddress(e.target.value)} disabled={saving} placeholder="e.g. 12 Elm Street" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="customerPhone">Customer phone</Label>
          <Input id="customerPhone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} disabled={saving} placeholder="Optional" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="customerEmail">Customer email</Label>
          <Input id="customerEmail" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} disabled={saving} placeholder="Optional" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="jobDate">Job date</Label>
          <Input id="jobDate" type="date" value={jobDate} onChange={(e) => setJobDate(e.target.value)} disabled={saving} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rawNotes">Job notes</Label>
        <Textarea
          id="rawNotes"
          value={rawNotes}
          onChange={(e) => setRawNotes(e.target.value)}
          disabled={saving}
          rows={6}
          placeholder={'e.g. "Customer called about a leaking radiator. Visited today. Found leak around valve. Replaced valve and tested system. Customer happy."'}
        />
        <p className="text-[12.5px] text-muted-foreground">Write it as roughly as you like — I&apos;ll turn it into a structured draft next.</p>
      </div>

      <Button variant="primary" onClick={submit} disabled={saving || !rawNotes.trim()} className="w-auto">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save &amp; continue
      </Button>
    </div>
  );
}
