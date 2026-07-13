import type { Metadata } from "next";
import { HireDemo } from "@/components/onboarding/hire-demo";

export const metadata: Metadata = { title: "See ReplyFlow in action — ReplyFlow" };

export default function DemoPage() {
  return <HireDemo />;
}
