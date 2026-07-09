"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepShell } from "@/components/onboarding/step-shell";

export function StepSuccess({ businessName }: { businessName: string }) {
  const router = useRouter();

  return (
    <StepShell>
      <div className="-mt-2 text-center">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success"
        >
          <Check className="h-7 w-7" strokeWidth={3} />
        </motion.div>
        <h1 className="mb-2 text-[24px] font-extrabold tracking-tight">You&apos;re all set! 🎉</h1>
        <p className="mb-8 text-[14.5px] leading-relaxed text-muted-foreground">
          {businessName || "Your business"} is now live on ReplyFlow. Your AI receptionist is already watching
          WhatsApp.
        </p>
        <Button variant="default" className="w-full" onClick={() => router.push("/dashboard")}>
          Go to Dashboard
        </Button>
      </div>
    </StepShell>
  );
}
