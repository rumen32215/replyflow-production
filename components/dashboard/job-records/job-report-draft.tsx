"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import type { Provenance } from "@/lib/job-docs/fields";

export interface DraftFieldData {
  key: string;
  value: string;
  provenance: Provenance;
}

function ProvenanceTag({ provenance }: { provenance: Provenance }) {
  if (provenance === "missing") return null;
  const label = provenance === "user_fact" ? "Your input" : provenance === "ai_structured" ? "AI-drafted" : "AI suggestion — please check";
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
        provenance === "user_fact" && "bg-success/10 text-success",
        provenance === "ai_structured" && "bg-accent text-primary",
        provenance === "ai_suggestion" && "bg-attention/15 text-attention"
      )}
    >
      {label}
    </span>
  );
}

/**
 * ReplyFlow 2.0, Phase 2 — the review/edit surface. Every field the AI
 * wrote is shown editable, next to a plain-language tag naming exactly
 * how confident/sourced it is (Provenance), so nothing AI-authored can
 * be mistaken for something the tradesperson actually said. Saving
 * moves a field's provenance to "user_fact" — see
 * app/api/job-docs/[id]/fields/route.ts — the user is always the one
 * who decides what the final content actually says.
 */
export function JobReportDraft({
  jobDocId,
  jobSummary,
  workPerformed,
  observations,
}: {
  jobDocId: string;
  jobSummary: DraftFieldData | null;
  workPerformed: DraftFieldData | null;
  observations: DraftFieldData[];
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summaryText, setSummaryText] = useState(jobSummary?.value ?? "");
  const [workText, setWorkText] = useState(workPerformed?.value ?? "");
  const [observationTexts, setObservationTexts] = useState(observations.map((o) => o.value));

  const hasDraft = Boolean(jobSummary || workPerformed || observations.length > 0);

  async function generate() {
    if (generating) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/job-docs/${jobDocId}/draft`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Something went wrong.");
      router.refresh();
    } catch (err) {
      toast({ variant: "destructive", title: "Couldn't generate a draft", description: err instanceof Error ? err.message : undefined });
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const fields: Record<string, string> = {};
      if (jobSummary) fields[jobSummary.key] = summaryText;
      if (workPerformed) fields[workPerformed.key] = workText;
      observations.forEach((o, i) => {
        fields[o.key] = observationTexts[i] ?? "";
      });

      const res = await fetch(`/api/job-docs/${jobDocId}/fields`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Something went wrong.");
      toast({ variant: "success", title: "Saved" });
      router.refresh();
    } catch (err) {
      toast({ variant: "destructive", title: "Couldn't save your edits", description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  if (!hasDraft) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">No draft yet</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">Generate a structured draft from the notes above — you&apos;ll be able to edit everything before it&apos;s saved.</p>
        </div>
        <Button variant="primary" onClick={generate} disabled={generating} className="w-auto">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? "Generating..." : "Generate Draft"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="jobSummary">Job Summary</Label>
          {jobSummary && <ProvenanceTag provenance={jobSummary.provenance} />}
        </div>
        <Textarea id="jobSummary" value={summaryText} onChange={(e) => setSummaryText(e.target.value)} disabled={saving} rows={2} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="workPerformed">Work Performed</Label>
          {workPerformed && <ProvenanceTag provenance={workPerformed.provenance} />}
        </div>
        <Textarea id="workPerformed" value={workText} onChange={(e) => setWorkText(e.target.value)} disabled={saving} rows={4} />
      </div>

      {observations.length > 0 && (
        <div className="space-y-2.5">
          <Label>Observations</Label>
          {observations.map((o, i) => (
            <div key={o.key} className="space-y-1">
              <div className="flex justify-end">
                <ProvenanceTag provenance={o.provenance} />
              </div>
              <Textarea
                value={observationTexts[i] ?? ""}
                onChange={(e) => {
                  const next = [...observationTexts];
                  next[i] = e.target.value;
                  setObservationTexts(next);
                }}
                disabled={saving}
                rows={2}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="primary" onClick={save} disabled={saving} className="w-auto">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </Button>
        <Button variant="outline" onClick={generate} disabled={generating || saving} className="w-auto">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Regenerate draft
        </Button>
      </div>
    </div>
  );
}
