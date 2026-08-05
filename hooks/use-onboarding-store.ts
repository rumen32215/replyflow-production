"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * V1 First-Run redesign — the one-minute setup: five real facts, and
 * nothing that can wait. Business name, trade, service area(s),
 * opening days, opening hours — every one of these is required before
 * the receptionist can say anything real in "Meet your receptionist."
 * Everything else (services, personality, payment methods, behaviour,
 * escalation, ...) is deliberately NOT here — that's "Teach your
 * receptionist," reached only after it's already been introduced.
 * Persisted to localStorage so a refresh or accidental back-navigation
 * doesn't cost the owner their progress. Cleared once the account is
 * provisioned.
 *
 * `serviceAreas` (V20) is an array, not a sentence — matches the
 * `businesses.service_areas` column, which has always been an array;
 * onboarding was the one surface still forcing it through a single
 * string.
 */
interface OnboardingState {
  businessName: string;
  trade: string;
  serviceAreas: string[];
  openDays: string[]; // DayKey values, e.g. ["mon","tue","wed","thu","fri"]
  openingTime: string;
  closingTime: string;

  setField: <K extends "businessName" | "trade" | "openingTime" | "closingTime">(key: K, value: string) => void;
  setServiceAreas: (areas: string[]) => void;
  setOpenDays: (days: string[]) => void;
  reset: () => void;
}

const initialState = {
  businessName: "",
  trade: "",
  serviceAreas: [] as string[],
  openDays: ["mon", "tue", "wed", "thu", "fri"],
  openingTime: "08:00",
  closingTime: "17:30",
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initialState,
      setField: (key, value) => set({ [key]: value }),
      setServiceAreas: (areas) => set({ serviceAreas: areas }),
      setOpenDays: (days) => set({ openDays: days }),
      reset: () => set(initialState),
    }),
    { name: "replyflow-onboarding" }
  )
);
