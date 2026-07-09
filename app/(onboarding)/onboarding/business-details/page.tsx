import type { Metadata } from "next";
import { StepBusinessDetails } from "@/components/onboarding/step-business-details";

export const metadata: Metadata = { title: "Business details — ReplyFlow" };

export default function Page() {
  return <StepBusinessDetails />;
}
