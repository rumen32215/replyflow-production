"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { onboardingSchema, type OnboardingData } from "@/lib/validations/onboarding";
import { TRADES, PLUMBING_SERVICES, GREETING_STYLES } from "@/lib/constants";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface BusinessProfileFormProps {
  businessId: string;
  defaultValues: OnboardingData;
}

export function BusinessProfileForm({ businessId, defaultValues }: BusinessProfileFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [submitting, setSubmitting] = useState(false);
  const [serviceAreas, setServiceAreas] = useState<string[]>(defaultValues.serviceAreas);
  const [areaDraft, setAreaDraft] = useState("");
  const [services, setServices] = useState<string[]>(defaultValues.services);
  const [greetingStyle, setGreetingStyle] = useState(defaultValues.greetingStyle);
  const [chargesCalloutFee, setChargesCalloutFee] = useState(defaultValues.chargesCalloutFee);
  const [offersEmergencyCallouts, setOffersEmergencyCallouts] = useState(defaultValues.offersEmergencyCallouts);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingData>({ resolver: zodResolver(onboardingSchema), defaultValues });

  function addArea(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || !areaDraft.trim()) return;
    e.preventDefault();
    if (!serviceAreas.includes(areaDraft.trim())) setServiceAreas([...serviceAreas, areaDraft.trim()]);
    setAreaDraft("");
  }

  function toggleService(service: string) {
    setServices((prev) => (prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]));
  }

  async function onSubmit(values: OnboardingData) {
    if (serviceAreas.length === 0) {
      toast({ variant: "destructive", title: "Add at least one service area" });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase
      .from("businesses")
      .update({
        business_name: values.businessName,
        phone: values.phone,
        opening_time: values.openingTime,
        closing_time: values.closingTime,
        offers_emergency_callouts: offersEmergencyCallouts,
        service_areas: serviceAreas,
        greeting_style: greetingStyle,
        business_description: values.businessDescription,
        services,
        charges_callout_fee: chargesCalloutFee,
        callout_fee_amount: chargesCalloutFee ? values.calloutFeeAmount : null,
      })
      .eq("id", businessId);
    setSubmitting(false);

    if (error) {
      toast({ variant: "destructive", title: "Couldn't save changes", description: error.message });
      return;
    }
    toast({ variant: "success", title: "Business profile updated" });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-5 text-[15px] font-bold">Basics</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="businessName">Business name</Label>
            <Input id="businessName" {...register("businessName")} />
            {errors.businessName && <p className="text-xs font-medium text-destructive">{errors.businessName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone number</Label>
            <Input id="phone" type="tel" {...register("phone")} />
            {errors.phone && <p className="text-xs font-medium text-destructive">{errors.phone.message}</p>}
          </div>
        </div>
        <div className="mt-4 space-y-1.5">
          <Label>Trade</Label>
          <div className="flex flex-wrap gap-2">
            {TRADES.map((trade) => (
              <span
                key={trade.value}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold",
                  trade.available ? "border-accent bg-accent text-primary" : "border-border text-muted-foreground/50"
                )}
              >
                {trade.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-5 text-[15px] font-bold">Hours &amp; coverage</h2>
        <div className="space-y-1.5">
          <Label>Opening hours</Label>
          <div className="grid grid-cols-2 gap-3">
            <Input type="time" {...register("openingTime")} />
            <Input type="time" {...register("closingTime")} />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-border p-3.5">
          <div>
            <p className="text-[13.5px] font-semibold">Emergency call-outs</p>
            <p className="text-xs text-muted-foreground">Offer out-of-hours emergency jobs</p>
          </div>
          <Switch checked={offersEmergencyCallouts} onCheckedChange={setOffersEmergencyCallouts} />
        </div>

        <div className="mt-4 space-y-1.5">
          <Label>
            Service area <span className="font-normal text-muted-foreground">— press enter to add</span>
          </Label>
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background p-2 focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15">
            {serviceAreas.map((area) => (
              <span
                key={area}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-3 pr-1.5 text-[13px] font-semibold"
              >
                {area}
                <button
                  type="button"
                  onClick={() => setServiceAreas(serviceAreas.filter((a) => a !== area))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              value={areaDraft}
              onChange={(e) => setAreaDraft(e.target.value)}
              onKeyDown={addArea}
              placeholder="Add a town..."
              className="min-w-[100px] flex-1 border-none bg-transparent px-1 py-1 text-[13.5px] outline-none"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-5 text-[15px] font-bold">How customers experience you</h2>
        <div className="space-y-1.5">
          <Label htmlFor="businessDescription">What do you do?</Label>
          <Textarea id="businessDescription" {...register("businessDescription")} />
          {errors.businessDescription && (
            <p className="text-xs font-medium text-destructive">{errors.businessDescription.message}</p>
          )}
        </div>

        <div className="mt-4 space-y-1.5">
          <Label>Services offered</Label>
          <div className="flex flex-wrap gap-2">
            {PLUMBING_SERVICES.map((service) => (
              <button
                key={service}
                type="button"
                onClick={() => toggleService(service)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors",
                  services.includes(service)
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:border-muted-foreground/40"
                )}
              >
                {service}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label>Greeting style</Label>
          <div className="space-y-2">
            {GREETING_STYLES.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => setGreetingStyle(g.value)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-colors",
                  greetingStyle === g.value ? "border-primary bg-accent" : "border-border hover:border-muted-foreground/30"
                )}
              >
                <p className="text-[13.5px] font-semibold">{g.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">&ldquo;{g.example}&rdquo;</p>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-border p-3.5">
          <span className="text-[13.5px] font-semibold">Call-out fee</span>
          <Switch checked={chargesCalloutFee} onCheckedChange={setChargesCalloutFee} />
        </div>
        {chargesCalloutFee && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[13.5px] text-muted-foreground">Amount</span>
            <Input className="max-w-[120px]" placeholder="£45" {...register("calloutFeeAmount")} />
          </div>
        )}
      </section>

      <Button type="submit" variant="default" disabled={submitting} className="w-auto px-6">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Save changes
      </Button>
    </form>
  );
}
