"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Check } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { OnboardingCTA } from "@/components/onboarding/onboarding-cta";
import { GradientText } from "@/components/shared/gradient-text";
import { EASE } from "@/components/shared/motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { signupSchema, type SignupInput } from "@/lib/validations/auth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const RULES = [
  { test: (v: string) => v.length >= 8, label: "At least 8 characters" },
  { test: (v: string) => /[A-Z]/.test(v), label: "One uppercase letter" },
  { test: (v: string) => /[0-9]/.test(v), label: "One number" },
];

/** Tenth founder review (2026-08-04): "the excitement disappears" —
 * sign-up should feel like the natural continuation of the landing
 * page, not a plain form it drops you into. Rotates instead of
 * sitting still, mirroring the same "the page feels alive" principle
 * as the Hero's headline and phone — but sequential, not randomised;
 * unlike the Hero's headline this isn't the visitor's first
 * impression, so there's no "always starts the same" problem to fix. */
const REASSURANCE_LINES = [
  "Usually takes under 60 seconds",
  "Connect your WhatsApp Business number",
  "Teach ReplyFlow about your business",
  "Ready to answer customers immediately",
] as const;

function useRotatingIndex(length: number, intervalMs: number): number {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % length), intervalMs);
    return () => clearInterval(id);
  }, [length, intervalMs]);
  return index;
}

export function SignupForm() {
  const router = useRouter();
  const supabase = createClient();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const reassuranceIndex = useRotatingIndex(REASSURANCE_LINES.length, 3200);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema), mode: "onChange" });

  const password = watch("password") || "";

  async function onSubmit(values: SignupInput) {
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/welcome` },
    });
    setSubmitting(false);

    if (error) {
      toast({ variant: "destructive", title: "Couldn't create account", description: error.message });
      return;
    }
    router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
  }

  return (
    <AuthCard>
      <h1 className="mb-1.5 text-[25px] font-extrabold tracking-tight">
        Let&apos;s meet your <GradientText>receptionist</GradientText>.
      </h1>
      <p className="mb-4 text-[14.5px] text-muted-foreground">
        In the next minute, you&apos;ll create an AI receptionist that understands your business.
      </p>

      {/* Rotating, not static — the same "the page feels alive"
       * principle as the Hero, continued into sign-up instead of
       * dropping into a plain form. */}
      <div className="mb-7 flex items-center gap-1.5 text-[13px] font-medium text-foreground/75">
        <Check className="h-3.5 w-3.5 shrink-0 text-success" strokeWidth={3} />
        <AnimatePresence mode="wait">
          <motion.span
            key={reassuranceIndex}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            {REASSURANCE_LINES[reassuranceIndex]}
          </motion.span>
        </AnimatePresence>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" placeholder="you@yourbusiness.com" {...register("email")} />
          {errors.email && <p className="text-xs font-medium text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="At least 8 characters"
              className="pr-11"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <ul className="grid grid-cols-1 gap-1 pt-1 sm:grid-cols-3">
            {RULES.map((rule) => {
              const met = rule.test(password);
              return (
                <li
                  key={rule.label}
                  className={cn(
                    "flex items-center gap-1.5 text-[11.5px] font-medium transition-colors",
                    met ? "text-success" : "text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-colors",
                      met ? "border-success bg-success text-white" : "border-border"
                    )}
                  >
                    {met && <Check className="h-2.5 w-2.5" />}
                  </span>
                  {rule.label}
                </li>
              );
            })}
          </ul>
        </div>

        <OnboardingCTA type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Continue
        </OnboardingCTA>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Log in
        </Link>
      </p>
      <p className="mt-3 text-center text-[11.5px] text-muted-foreground/70">
        By continuing, you agree to ReplyFlow&apos;s Terms and Privacy Policy.
      </p>
    </AuthCard>
  );
}
