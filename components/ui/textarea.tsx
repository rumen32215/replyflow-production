import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[90px] w-full rounded-md border border-input bg-card px-3.5 py-2.5 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/70",
        "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15",
        "disabled:cursor-not-allowed disabled:opacity-50 resize-y",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export { Textarea };
