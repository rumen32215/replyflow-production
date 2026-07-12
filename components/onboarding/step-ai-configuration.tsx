"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { StepShell } from "@/components/onboarding/step-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";
import { PLUMBING_SERVICES } from "@/lib/constants";
import { onboardingSchema } from "@/lib/validations/onboarding";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function StepAiConfiguration() {
  const router = useRouter();
  const supabase = createClient();
  const store = useOnboardingStore();
  const [submitting, setSubmitting] = useState(false);
  const [descError, setDescError] = useState<string | null>(null);

  function toggleService(service: string) {
    store.setField(
      "services",
      store.services.includes(service)
        ? store.services.filter((s) => s !== service)
        : [...store.services, service]
    );
  }

  async function handleSubmit() {
    const payload = {
      businessName: store.businessName,
      phone: store.phone,
      trade: store.trade,
      openingTime: store.openingTime,
      closingTime: store.closingTime,
      offersEmergencyCallouts: store.offersEmergencyCallouts,
      serviceAreas: store.serviceAreas,
      logoUrl: "",
      greetingStyle: store.greetingStyle,
      businessDescription: store.businessDescription,
      services: store.services,
      chargesCalloutFee: store.chargesCalloutFee,
      calloutFeeAmount: store.calloutFeeAmount,
    };

    const result = onboardingSchema.safeParse(payload);
    if (!result.success) {
      const desc = result.error.issues.find((i) => i.path[0] === "businessDescription");
      if (desc) setDescError(desc.message);
      toast({ variant: "destructive", title: "A couple of fields need attention" });
      return;
    }
    setDescError(null);
    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSubmitting(false);
      toast({ variant: "destructive", title: "Your session expired", description: "Please log in again." });
      router.push("/login");
      return;
    }

    const { error } = await supabase.from("businesses").upsert(
      {
        owner_id: user.id,
        business_name: result.data.businessName,
        phone: result.data.phone,
        trade: result.data.trade,
        opening_time: result.data.openingTime,
        closing_time: result.data.closingTime,
        offers_emergency_callouts: result.data.offersEmergencyCallouts,
        service_areas: result.data.serviceAreas,
        logo_url: store.logoUrl || null,
        greeting_style: result.data.greetingStyle,
        business_description: result.data.businessDescription,
        services: result.data.services,
        charges_callout_fee: result.data.chargesCalloutFee,
        callout_fee_amount: result.data.calloutFeeAmount || null,
        whatsapp_connected: store.whatsappStatus === "connected",
        onboarding_completed: true,
      },
      { onConflict: "owner_id" }
    );

    setSubmitting(false);

    if (error) {
      const isMissingTable =
        error.message.includes("schema cache") || error.code === "PGRST205";

      toast({
        variant: "destructive",
        title: isMissingTable ? "Database not set up yet" : "Couldn't save your setup",
        description: isMissingTable
          ? "The businesses table hasn't been created in Supabase yet. Run the migration in supabase/migrations, then try again."
          : error.message,
      });
      return;
    }

    store.reset();
    router.push("/onboarding/success");
  }

  return (
    <StepShell
      step={4}
      title="Teach ReplyFlow about your business"
subtitle="Answer a few simple questions so ReplyFlow can reply to customers the way you would."
      backHref="/onboarding/business-details"
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="description">
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-extrabold text-primary">
              Q1
            </span>
            Tell ReplyFlow about your business
          </Label>
          <Textarea
            id="description"
            placeholder="Example: We repair boilers, fix leaks, install bathrooms and help with emergency plumbing. Always ask customers for their postcode and photos before booking."
            value={store.businessDescription}
            onChange={(e) => store.setField("businessDescription", e.target.value)}
          />
          {descError && <p className="text-xs font-medium text-destructive">{descError}</p>}
        </div>

        <div className="space-y-2">
          <Label>
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-extrabold text-primary">
              Q2
            </span>
            Which services would you like ReplyFlow to mention to customers?
          </Label>
          <div className="flex flex-wrap gap-2">
            {PLUMBING_SERVICES.map((service) => (
              <button
                key={service}
                type="button"
                onClick={() => toggleService(service)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors",
                  store.services.includes(service)
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:border-muted-foreground/40"
                )}
              >
                {service}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-extrabold text-primary">
              Q3
            </span>
            What areas do you cover?
          </Label>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 p-3">
            <div className="flex flex-wrap gap-1.5">
              {store.serviceAreas.length > 0 ? (
                store.serviceAreas.map((a) => (
                  <span key={a} className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold">
                    {a}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">No areas added yet</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => router.push("/onboarding/business-details")}
              className="shrink-0 text-xs font-semibold text-primary hover:underline"
            >
              Edit
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-extrabold text-primary">
              Q4
            </span>
            When are you open?
          </Label>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 p-3">
            <span className="text-[13.5px] font-semibold">
              {store.openingTime} – {store.closingTime}
            </span>
            <button
              type="button"
              onClick={() => router.push("/onboarding/business-details")}
              className="shrink-0 text-xs font-semibold text-primary hover:underline"
            >
              Edit
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-extrabold text-primary">
              Q5
            </span>
            Do you charge a call-out fee?
          </Label>
          <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
            <span className="text-[13.5px] font-semibold">Call-out fee</span>
            <Switch
              checked={store.chargesCalloutFee}
              onCheckedChange={(v) => store.setField("chargesCalloutFee", v)}
            />
          </div>
          {store.chargesCalloutFee && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[13.5px] text-muted-foreground">Amount</span>
              <Input
                className="max-w-[120px]"
                placeholder="£45"
                value={store.calloutFeeAmount}
                onChange={(e) => store.setField("calloutFeeAmount", e.target.value)}
              />
            </div>
          )}
        </div>

        <Button type="button" variant="success" className="mt-2 w-full" onClick={handleSubmit} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Launch ReplyFlow
        </Button>
      </div>
    </StepShell>
  );
}
