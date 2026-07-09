import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes safely, resolving conflicts (e.g. "p-2 p-4" -> "p-4").
 * Used by every component in components/ui.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
