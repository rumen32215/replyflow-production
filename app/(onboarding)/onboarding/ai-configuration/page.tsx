import type { Metadata } from "next";
import { StepAiConfiguration } from "@/components/onboarding/step-ai-configuration";

export const metadata: Metadata = { title: "AI configuration — ReplyFlow" };

export default function Page() {
  return <StepAiConfiguration />;
}
