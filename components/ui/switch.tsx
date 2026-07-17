"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-6 w-[42px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-success data-[state=unchecked]:bg-muted",
      className
    )}
    {...props}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform",
        "data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

/**
 * Purely visual switch — same look as `Switch`, but renders as a
 * `<span>`, not a real button. Radix's Switch root is a native
 * `<button role="switch">`, so it can never be nested inside another
 * clickable element (e.g. a whole row that's already a `<button>`) —
 * that's invalid HTML (`<button>` cannot contain `<button>`) and
 * breaks hydration. Use this wherever the toggle is just mirroring
 * state for a tap target that lives on a surrounding element.
 */
function SwitchVisual({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-6 w-[42px] shrink-0 items-center rounded-full border-2 border-transparent transition-colors",
        checked ? "bg-success" : "bg-muted",
        className
      )}
    >
      <span
        className={cn(
          "block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0"
        )}
      />
    </span>
  );
}

export { Switch, SwitchVisual };
