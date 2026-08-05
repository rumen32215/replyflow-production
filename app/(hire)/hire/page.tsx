import type { Metadata } from "next";
import { HiringConversation } from "@/components/onboarding/hiring-conversation";

export const metadata: Metadata = { title: "ReplyFlow" };

export default function HirePage() {
  return <HiringConversation />;
}
