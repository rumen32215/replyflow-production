import type { Metadata } from "next";
import { BusinessNameStep } from "@/components/onboarding/business-name-step";

export const metadata: Metadata = { title: "Your business name — ReplyFlow" };

export default function BusinessNamePage() {
  return <BusinessNameStep />;
}
