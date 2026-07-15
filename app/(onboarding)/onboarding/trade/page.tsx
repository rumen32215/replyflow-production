import type { Metadata } from "next";
import { TradeStep } from "@/components/onboarding/trade-step";

export const metadata: Metadata = { title: "Your trade — ReplyFlow" };

export default function TradePage() {
  return <TradeStep />;
}
