"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

/**
 * Production hardening (2026-08-15) — optional, owner-entered charges
 * on the Job Report (0038). Deliberately its own small component, not
 * nested inside JobReportDraft: unlike every other field there, this
 * one has nothing to do with the AI draft — an owner should be able to
 * put a price on a job whether or not a draft has even been generated
 * yet, and there is no provenance tag here because there is no AI
 * involvement to distinguish from — every value on this form was
 * always the owner's own.
 *
 * Total is shown, never entered — labour + materials, computed the
 * same way the report itself computes it
 * (lib/job-docs/report-content.ts's selectCharges), so this form can
 * never disagree with what the customer actually sees.
 */
export function ReportCharges({
  jobDocId,
  initialLabour,
  initialMaterials,
}: {
  jobDocId: string;
  initialLabour: number | null;
  initialMaterials: number | null;
}) {
  const router = useRouter();
  const [labour, setLabour] = useState(initialLabour != null ? String(initialLabour) : "");
  const [materials, setMaterials] = useState(initialMaterials != null ? String(initialMaterials) : "");
  const [saving, setSaving] = useState(false);

  const labourNumber = labour.trim() === "" ? null : Number(labour);
  const materialsNumber = materials.trim() === "" ? null : Number(materials);
  const total = (labourNumber ?? 0) + (materialsNumber ?? 0);
  const hasAnyAmount = labourNumber != null || materialsNumber != null;

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/job-docs/${jobDocId}/charges`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labour: labourNumber, materials: materialsNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Something went wrong.");
      toast({ variant: "success", title: "Saved" });
      router.refresh();
    } catch (err) {
      toast({ variant: "destructive", title: "Couldn't save that", description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="chargeLabour">Labour / Work (£)</Label>
          <input
            id="chargeLabour"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={labour}
            onChange={(e) => setLabour(e.target.value)}
            disabled={saving}
            placeholder="Not set"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13.5px] outline-none focus:border-primary"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="chargeMaterials">Materials (£)</Label>
          <input
            id="chargeMaterials"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={materials}
            onChange={(e) => setMaterials(e.target.value)}
            disabled={saving}
            placeholder="Not set"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13.5px] outline-none focus:border-primary"
          />
        </div>
      </div>
      {hasAnyAmount && <p className="text-[13px] text-muted-foreground">Total on the report: <span className="font-semibold text-foreground">£{total.toFixed(2)}</span></p>}
      <Button variant="outline" onClick={save} disabled={saving} className="w-auto">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save charges
      </Button>
    </div>
  );
}
