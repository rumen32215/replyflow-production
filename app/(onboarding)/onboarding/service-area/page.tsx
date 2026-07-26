import type { Metadata } from "next";
import { ServiceAreaStep } from "@/components/onboarding/service-area-step";

export const metadata: Metadata = { title: "Where do you cover — ReplyFlow" };

export default function ServiceAreaPage() {
  return <ServiceAreaStep />;
}
