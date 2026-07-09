import type { Metadata } from "next";
import { StepConnectWhatsApp } from "@/components/onboarding/step-connect-whatsapp";

export const metadata: Metadata = { title: "Connect WhatsApp — ReplyFlow" };

export default function Page() {
  return <StepConnectWhatsApp />;
}
