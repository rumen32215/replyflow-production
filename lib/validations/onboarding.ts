import { z } from "zod";

/**
 * One schema per onboarding step so each step can validate independently
 * (and so the Zustand store in hooks/use-onboarding-store.ts stays typed).
 * businessDetailsSchema / aiConfigSchema are merged into one Supabase
 * write on the final step — see components/onboarding/StepSuccess.tsx.
 */

export const businessInfoSchema = z.object({
  businessName: z.string().min(2, "Business name is required"),
  phone: z
    .string()
    .min(7, "Enter a valid phone number")
    .regex(/^[0-9+\s()-]+$/, "Enter a valid phone number"),
});
export type BusinessInfoInput = z.infer<typeof businessInfoSchema>;

export const businessDetailsSchema = z.object({
  trade: z.literal("plumbing"),
  openingTime: z.string().min(1, "Set your opening time"),
  closingTime: z.string().min(1, "Set your closing time"),
  offersEmergencyCallouts: z.boolean(),
  serviceAreas: z.array(z.string().min(1)).min(1, "Add at least one service area"),
  logoUrl: z.string().url().optional().or(z.literal("")),
  greetingStyle: z.enum(["professional", "friendly", "concise"]),
});
export type BusinessDetailsInput = z.infer<typeof businessDetailsSchema>;

export const aiConfigSchema = z.object({
  businessDescription: z
    .string()
    .min(10, "Tell the AI a little more about what you do (10+ characters)"),
  services: z.array(z.string()).min(1, "Select at least one service"),
  chargesCalloutFee: z.boolean(),
  calloutFeeAmount: z.string().optional(),
});
export type AiConfigInput = z.infer<typeof aiConfigSchema>;

/** Full shape persisted to the `businesses` table on completion. */
export const onboardingSchema = businessInfoSchema
  .merge(businessDetailsSchema)
  .merge(aiConfigSchema);
export type OnboardingData = z.infer<typeof onboardingSchema>;
