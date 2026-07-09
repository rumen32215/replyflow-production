import type { Metadata } from "next";
import { StepBusinessInfo } from "@/components/onboarding/step-business-info";

export const metadata: Metadata = { title: "Business information — ReplyFlow" };

export default function Page() {
  return <StepBusinessInfo />;
}
