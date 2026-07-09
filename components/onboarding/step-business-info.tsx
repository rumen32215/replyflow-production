"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { StepShell } from "@/components/onboarding/step-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { businessInfoSchema, type BusinessInfoInput } from "@/lib/validations/onboarding";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";

export function StepBusinessInfo() {
  const router = useRouter();
  const { businessName, phone, setField } = useOnboardingStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BusinessInfoInput>({
    resolver: zodResolver(businessInfoSchema),
    defaultValues: { businessName, phone },
  });

  function onSubmit(values: BusinessInfoInput) {
    setField("businessName", values.businessName);
    setField("phone", values.phone);
    router.push("/onboarding/connect-whatsapp");
  }

  return (
    <StepShell step={1} title="Tell us about your business" subtitle="Just the basics — you can change this anytime.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="businessName">Business name</Label>
          <Input id="businessName" placeholder="ABC Plumbing" {...register("businessName")} />
          {errors.businessName && (
            <p className="text-xs font-medium text-destructive">{errors.businessName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone number</Label>
          <Input id="phone" type="tel" placeholder="07123 456789" {...register("phone")} />
          {errors.phone && <p className="text-xs font-medium text-destructive">{errors.phone.message}</p>}
        </div>

        <Button type="submit" variant="default" className="mt-2 w-full">
          Continue
        </Button>
      </form>
    </StepShell>
  );
}
