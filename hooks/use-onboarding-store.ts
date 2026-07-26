"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * V1 First-Run redesign — the one-minute setup: five real facts, and
 * nothing that can wait. Business name, trade, service area, opening
 * days, opening hours — every one of these is required before the
 * receptionist can say anything real in "Meet your receptionist."
 * Everything else (services, personality, payment methods, behaviour,
 * escalation, ...) is deliberately NOT here — that's "Teach your
 * receptionist," reached only after she's already been introduced.
 * Persisted to localStorage so a refresh or accidental back-navigation
 * doesn't cost the owner their progress. Cleared by the preparing
 * screen once the account is provisioned.
 */
interface OnboardingState {
  businessName: string;
  trade: string;
  serviceArea: string;
  openDays: string[]; // DayKey values, e.g. ["mon","tue","wed","thu","fri"]
  openingTime: string;
  closingTime: string;

  setField: <K extends "businessName" | "trade" | "serviceArea" | "openingTime" | "closingTime">(
    key: K,
    value: string
  ) => void;
  setOpenDays: (days: string[]) => void;
  reset: () => void;
}

const initialState = {
  businessName: "",
  trade: "",
  serviceArea: "",
  openDays: ["mon", "tue", "wed", "thu", "fri"],
  openingTime: "08:00",
  closingTime: "17:30",
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initialState,
      setField: (key, value) => set({ [key]: value }),
      setOpenDays: (days) => set({ openDays: days }),
      reset: () => set(initialState),
    }),
    { name: "replyflow-onboarding" }
  )
);
