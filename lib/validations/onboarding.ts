import { z } from "zod";

/**
 * Schemas for the full business record. Onboarding itself no longer
 * collects most of this (it asks only name + trade — see
 * hooks/use-onboarding-store.ts); these schemas now serve the
 * dashboard's Business Profile form, where owners personalise
 * everything after value has been delivered (Decision 005 / 006).
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
    .min(10, "Tell your receptionist a little more about what you do (10+ characters)"),
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
