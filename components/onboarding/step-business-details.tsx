"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Upload } from "lucide-react";
import { StepShell } from "@/components/onboarding/step-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";
import { TRADES, GREETING_STYLES } from "@/lib/constants";
import { businessDetailsSchema } from "@/lib/validations/onboarding";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export function StepBusinessDetails() {
  const router = useRouter();
  const store = useOnboardingStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [areaDraft, setAreaDraft] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function addArea(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || !areaDraft.trim()) return;
    e.preventDefault();
    if (!store.serviceAreas.includes(areaDraft.trim())) {
      store.setField("serviceAreas", [...store.serviceAreas, areaDraft.trim()]);
    }
    setAreaDraft("");
  }

  function removeArea(area: string) {
    store.setField(
      "serviceAreas",
      store.serviceAreas.filter((a) => a !== area)
    );
  }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // NOTE: this stores a local object URL for preview only. Wiring this
    // to Supabase Storage (bucket + signed upload) is a fast-follow —
    // not required for the onboarding data to be useful on day one.
    const url = URL.createObjectURL(file);
    store.setField("logoUrl", url);
  }

  function handleSubmit() {
    const result = businessDetailsSchema.safeParse({
      trade: store.trade,
      openingTime: store.openingTime,
      closingTime: store.closingTime,
      offersEmergencyCallouts: store.offersEmergencyCallouts,
      serviceAreas: store.serviceAreas,
      logoUrl: "",
      greetingStyle: store.greetingStyle,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        fieldErrors[issue.path[0] as string] = issue.message;
      });
      setErrors(fieldErrors);
      toast({ variant: "destructive", title: "A couple of fields need attention" });
      return;
    }

    router.push("/onboarding/ai-configuration");
  }

  return (
    <StepShell
      step={3}
      title="A few more business details"
      subtitle="This shapes how ReplyFlow presents your business to customers."
      backHref="/onboarding/connect-whatsapp"
    >
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label>Trade</Label>
          <div className="flex flex-wrap gap-2">
            {TRADES.map((trade) => (
              <span
                key={trade.value}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold",
                  trade.available
                    ? "border-accent bg-accent text-primary"
                    : "border-border text-muted-foreground/50"
                )}
              >
                {trade.label}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground/70">More trades unlock soon — you&apos;re set for Plumbing.</p>
        </div>

        <div className="space-y-1.5">
          <Label>Opening hours</Label>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="time"
              value={store.openingTime}
              onChange={(e) => store.setField("openingTime", e.target.value)}
            />
            <Input
              type="time"
              value={store.closingTime}
              onChange={(e) => store.setField("closingTime", e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
          <div>
            <p className="text-[13.5px] font-semibold">Emergency call-outs</p>
            <p className="text-xs text-muted-foreground">Offer out-of-hours emergency jobs</p>
          </div>
          <Switch
            checked={store.offersEmergencyCallouts}
            onCheckedChange={(v) => store.setField("offersEmergencyCallouts", v)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>
            Service area <span className="font-normal text-muted-foreground">— press enter to add</span>
          </Label>
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-card p-2 focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15">
            {store.serviceAreas.map((area) => (
              <span
                key={area}
                className="flex items-center gap-1.5 rounded-full border border-border bg-background py-1 pl-3 pr-1.5 text-[13px] font-semibold"
              >
                {area}
                <button onClick={() => removeArea(area)} className="text-muted-foreground hover:text-foreground">
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
          {errors.serviceAreas && <p className="text-xs font-medium text-destructive">{errors.serviceAreas}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Company logo</Label>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border border-border">
              <AvatarImage src={store.logoUrl} alt="Logo preview" />
              <AvatarFallback>{(store.businessName || "R").slice(0, 1)}</AvatarFallback>
            </Avatar>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Upload logo
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Greeting style</Label>
          <div className="space-y-2">
            {GREETING_STYLES.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => store.setField("greetingStyle", g.value)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-colors",
                  store.greetingStyle === g.value ? "border-primary bg-accent" : "border-border hover:border-muted-foreground/30"
                )}
              >
                <p className="text-[13.5px] font-semibold">{g.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">&ldquo;{g.example}&rdquo;</p>
              </button>
            ))}
          </div>
        </div>

        <Button type="button" variant="default" className="w-full" onClick={handleSubmit}>
          Continue
        </Button>
      </div>
    </StepShell>
  );
}
