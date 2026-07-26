import type { Metadata } from "next";
import { HoursStep } from "@/components/onboarding/hours-step";

export const metadata: Metadata = { title: "Your hours — ReplyFlow" };

export default function HoursPage() {
  return <HoursStep />;
}
