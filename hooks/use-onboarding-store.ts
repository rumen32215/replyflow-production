"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Holds the two answers onboarding actually asks for — business name
 * (Screen 3) and trade (Screen 4). Persisted to localStorage so a
 * refresh or accidental back-navigation doesn't cost the owner their
 * progress. Cleared by the preparing screen once the account is
 * provisioned and the dashboard opens.
 *
 * Everything else about the business (hours, services, greeting style,
 * logo, ...) is deliberately NOT here: configuration lives in the
 * dashboard's Business Profile, after value — never in onboarding
 * (Decision Log 005 / 006).
 */
interface OnboardingState {
  businessName: string;
  trade: string;

  setField: <K extends "businessName" | "trade">(key: K, value: string) => void;
  reset: () => void;
}

const initialState = {
  businessName: "",
  trade: "",
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
