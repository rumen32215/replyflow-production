"use client";

import { useEffect } from "react";
import { RefreshCcw } from "lucide-react";
import { SettleCard } from "@/components/shared/motion";

/**
 * Same calm, first-person voice as the (dashboard) error boundary —
 * a failed step shouldn't feel like the whole setup broke. Whatever
 * was already answered is saved (each step persists as it's taught),
 * so retrying picks up from here, not from the start.
 */
export default function OnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 py-24 text-center">
      <SettleCard className="flex flex-col items-center gap-4">
        <h1 className="text-[20px] font-extrabold tracking-tight">I&apos;m having trouble loading this.</h1>
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          This is usually temporary. What you&apos;ve already told me is safe.
        </p>
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[13.5px] font-semibold text-primary-foreground shadow-sm transition-transform active:scale-95"
        >
          <RefreshCcw className="h-4 w-4" />
          Try again
        </button>
      </SettleCard>
    </div>
  );
}
