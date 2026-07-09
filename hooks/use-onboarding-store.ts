"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Holds onboarding form state across the 5-step wizard (which is 5
 * separate routes, not a single-page form — see app/(onboarding)).
 * Persisted to localStorage so a refresh or accidental back-navigation
 * doesn't cost the user their progress. Cleared on successful submit
 * in StepSuccess.tsx.
 */
interface OnboardingState {
  businessName: string;
  phone: string;
  whatsappStatus: "not_connected" | "connecting" | "connected";
  trade: "plumbing";
  openingTime: string;
  closingTime: string;
  offersEmergencyCallouts: boolean;
  serviceAreas: string[];
  logoUrl: string;
  greetingStyle: "professional" | "friendly" | "concise";
  businessDescription: string;
  services: string[];
  chargesCalloutFee: boolean;
  calloutFeeAmount: string;

  setField: <K extends keyof OnboardingState>(key: K, value: OnboardingState[K]) => void;
  reset: () => void;
}

const initialState = {
  businessName: "",
  phone: "",
  whatsappStatus: "not_connected" as const,
  trade: "plumbing" as const,
  openingTime: "08:00",
  closingTime: "17:30",
  offersEmergencyCallouts: true,
  serviceAreas: [] as string[],
  logoUrl: "",
  greetingStyle: "friendly" as const,
  businessDescription: "",
  services: [] as string[],
  chargesCalloutFee: false,
  calloutFeeAmount: "",
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initialState,
      setField: (key, value) => set({ [key]: value }),
      reset: () => set(initialState),
    }),
    { name: "replyflow-onboarding" }
  )
);
