"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { aiConfigurationSchema, type AiConfigurationInput } from "@/lib/validations/ai-configuration";
import { GREETING_STYLES } from "@/lib/constants";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function AiReceptionistForm({
  businessId,
  defaultValues,
}: {
  businessId: string;
  defaultValues: AiConfigurationInput;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AiConfigurationInput>({ resolver: zodResolver(aiConfigurationSchema), defaultValues });

  const { fields, append, remove } = useFieldArray({ control, name: "faqs" });
  const tone = watch("tone");

  async function onSubmit(values: AiConfigurationInput) {
    setSubmitting(true);
    const { error } = await supabase.from("ai_configurations").upsert(
      {
        business_id: businessId,
        tone: values.tone,
        system_prompt: values.systemPrompt,
        business_rules: values.businessRules,
        escalation_rules: values.escalationRules,
        faqs: values.faqs,
      },
      { onConflict: "business_id" }
    );
    setSubmitting(false);

    if (error) {
      toast({ variant: "destructive", title: "Couldn't save configuration", description: error.message });
      return;
    }
    toast({ variant: "success", title: "AI Receptionist updated" });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-1 text-[15px] font-bold">Tone</h2>
        <p className="mb-4 text-[13px] text-muted-foreground">How your AI receptionist should sound in every reply.</p>
        <div className="space-y-2">
          {GREETING_STYLES.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setValue("tone", g.value, { shouldDirty: true })}
              className={cn(
                "w-full rounded-xl border p-3 text-left transition-colors",
                tone === g.value ? "border-primary bg-accent" : "border-border hover:border-muted-foreground/30"
              )}
            >
              <p className="text-[13.5px] font-semibold">{g.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">&ldquo;{g.example}&rdquo;</p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-1 text-[15px] font-bold">Instructions</h2>
        <p className="mb-4 text-[13px] text-muted-foreground">
          The core brief your AI receptionist works from — write it like you&apos;re briefing a new employee.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="systemPrompt">What should the AI know and do?</Label>
          <Textarea
            id="systemPrompt"
            className="min-h-[110px]"
            placeholder="You're the friendly first point of contact for ABC Plumbing. Greet customers warmly, ask what the problem is, get their postcode and a photo if it's a visual issue, and flag anything that sounds like an emergency."
            {...register("systemPrompt")}
          />
          {errors.systemPrompt && <p className="text-xs font-medium text-destructive">{errors.systemPrompt.message}</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-1 text-[15px] font-bold">Business rules</h2>
        <p className="mb-4 text-[13px] text-muted-foreground">
          Anything the AI should always follow — pricing boundaries, scheduling constraints, things it should never promise.
        </p>
        <Textarea
          placeholder="Never quote exact prices over WhatsApp — always say 'the team will confirm pricing after a quick look.' Standard jobs get booked within 3 working days."
          {...register("businessRules")}
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-1 text-[15px] font-bold">Escalation rules</h2>
        <p className="mb-4 text-[13px] text-muted-foreground">
          When should the AI stop and hand the conversation to you?
        </p>
        <Textarea
          placeholder="Hand off immediately if the customer mentions a gas leak, flooding, or asks to speak to a person directly."
          {...register("escalationRules")}
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold">FAQs</h2>
            <p className="text-[13px] text-muted-foreground">Answers the AI can give instantly, word for word.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ question: "", answer: "" })}
          >
            <Plus className="h-3.5 w-3.5" /> Add FAQ
          </Button>
        </div>

        {fields.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            No FAQs yet — add the questions customers ask most.
          </p>
        ) : (
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="rounded-xl border border-border p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor={`faqs.${index}.question`}>Question</Label>
                    <Input
                      id={`faqs.${index}.question`}
                      placeholder="Do you offer weekend call-outs?"
                      {...register(`faqs.${index}.question` as `faqs.${number}.question`)}
                    />
                    {errors.faqs?.[index]?.question && (
                      <p className="text-xs font-medium text-destructive">{errors.faqs[index]?.question?.message}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="mt-6 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remove FAQ"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`faqs.${index}.answer`}>Answer</Label>
                  <Textarea
                    id={`faqs.${index}.answer`}
                    placeholder="Yes, emergency call-outs are available on weekends with a call-out fee."
                    {...register(`faqs.${index}.answer` as `faqs.${number}.answer`)}
                  />
                  {errors.faqs?.[index]?.answer && (
                    <p className="text-xs font-medium text-destructive">{errors.faqs[index]?.answer?.message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Button type="submit" variant="default" disabled={submitting} className="w-auto px-6">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Save configuration
      </Button>
    </form>
  );
}
