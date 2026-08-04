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
 * impression, so there's no "always starts the same" problem to fix.
 *
 * V8 "Rewrite around outcomes" (2026-08-04): the original four leaned
 * on process ("connect", "teach") and one said "ReplyFlow" doing
 * something *to* the owner rather than *for* them — exactly the
 * setup-flavoured framing the brief asked to strip out. Rewritten so
 * every line names something the owner gains, not a step they do. */
const REASSURANCE_LINES = [
  "Never miss another customer message",
  "Works on the WhatsApp number you already use",
  "Learns how you run things — hours, pricing, the lot",
  "Takes about a minute to set up",
  "Ready to start catching messages today",
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
    formState: { errors, isValid },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema), mode: "onChange" });

  const email = watch("email") || "";
  const password = watch("password") || "";
  const emailValid = email.length > 0 && !errors.email;
  const rulesPassed = RULES.filter((rule) => rule.test(password)).length;
  const passwordValid = password.length > 0 && rulesPassed === RULES.length;

  async function onSubmit(values: SignupInput) {
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/welcome` },
    });
    setSubmitting(false);

    if (error) {
      toast({ variant: "destructive", title: "Couldn't create account", description: error.message });
      return;
    }

    // V10 founder review (2026-08-04): "don't interrupt momentum by
    // sending the visitor to email verification... continue directly
    // into onboarding... someone who just decided to try ReplyFlow
    // should immediately experience ReplyFlow." Verification itself
    // isn't removed — it moves later (`VerifyEmailGate`, gating the
    // WhatsApp connection, the actual point real customer messages
    // start flowing) rather than sitting in front of onboarding.
    //
    // `data.session` is the deciding signal, not an assumption: it
    // only exists if the Supabase project grants a session straight
    // out of `signUp()` (i.e. "Confirm email" is off). If a project
    // still requires confirmation first, this falls back to exactly
    // the previous behaviour — nobody gets stranded on a page their
    // session can't actually reach.
    if (data.session) {
      router.push("/onboarding/business-name");
    } else {
      router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
    }
  }

  return (
    <AuthCard>
      <h1 className="mb-1.5 text-[25px] font-extrabold tracking-tight">
        Let&apos;s meet your <GradientText>receptionist</GradientText>.
      </h1>
      <p className="mb-4 text-[14.5px] text-muted-foreground">
        In the next minute, you&apos;ll have someone answering your customers — even when your hands are full.
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
          {/* V9 founder review (2026-08-04): "successful email input
           * subtly transitions toward ReplyFlow green" — a quiet
           * confirmation the moment the field is actually valid,
           * rather than only ever showing red for what's wrong. */}
          <Input
            id="email"
            type="email"
            placeholder="you@yourbusiness.com"
            className={cn(
              "transition-colors duration-500",
              emailValid && "border-success/50 focus-visible:border-success focus-visible:ring-success/15"
            )}
            {...register("email")}
          />
          {errors.email && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="text-xs font-medium text-destructive"
            >
              {errors.email.message}
            </motion.p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            {/* Same quiet green confirmation as email, once every rule
             * below is actually met — the field itself, not just the
             * checklist beneath it, tells you when it's ready. */}
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="At least 8 characters"
              className={cn(
                "pr-11 transition-colors duration-500",
                passwordValid && "border-success/50 focus-visible:border-success focus-visible:ring-success/15"
              )}
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
                    {/* A small spring pop instead of an instant swap —
                     * "the password field feels more alive" (V9). */}
                    <AnimatePresence>
                      {met && (
                        <motion.span
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 20 }}
                        >
                          <Check className="h-2.5 w-2.5" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                  {rule.label}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Reuses the shared onboarding CTA — same premium spring and
         * light-sweep as every onboarding screen and the Hero's own
         * button, deliberately not a new one-off animation (V9: "the
         * same premium interaction philosophy... without becoming
         * repetitive"). What's unique to *this* button is the moment
         * it earns, not a new visual signature: it stays quietly
         * dimmed until the form is actually ready, then comes alive —
         * a state most of the onboarding screens' own buttons never
         * have a reason to pass through, since a single choice is
         * valid the instant it's made. */}
        <OnboardingCTA type="submit" disabled={submitting || !isValid}>
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
