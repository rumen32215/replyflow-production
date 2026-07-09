"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ONBOARDING_STEPS } from "@/lib/constants";

interface StepShellProps {
  /** 1-indexed position within ONBOARDING_STEPS. Omit on the success screen. */
  step?: number;
  title?: string;
  subtitle?: string;
  backHref?: string;
  children: React.ReactNode;
}

/**
 * Every onboarding step (except Success) renders inside this shell so
 * the card size, progress bar, back button, and title styling never
 * drift between steps — change it once here, every step updates.
 */
export function StepShell({ step, title, subtitle, backHref, children }: StepShellProps) {
  const router = useRouter();
  const totalSteps = ONBOARDING_STEPS.length;
  const progress = step ? Math.round((step / totalSteps) * 100) : 100;

  return (
    <div className="rounded-3xl border border-border bg-card p-10 shadow-elevated">
      {backHref && (
        <button
          onClick={() => router.push(backHref)}
          aria-label="Back"
          className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="h-[18px] w-[18px]" />
        </button>
      )}

      {step && (
        <div className="mb-7">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12.5px] font-semibold text-muted-foreground">
              Step {step} of {totalSteps}
            </span>
            <span className="text-[12.5px] font-semibold text-muted-foreground">{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>
      )}

      {title && <h1 className="mb-1.5 text-[24px] font-extrabold tracking-tight leading-tight">{title}</h1>}
      {subtitle && <p className="mb-7 text-[14.5px] text-muted-foreground leading-relaxed">{subtitle}</p>}

      {children}
    </div>
  );
}
