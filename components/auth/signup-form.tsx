"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Check } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
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

export function SignupForm() {
  const router = useRouter();
  const supabase = createClient();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      options: { emailRedirectTo: `${window.location.origin}/welcome` },
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
      <h1 className="mb-1.5 text-[25px] font-extrabold tracking-tight">Create your account</h1>
      <p className="mb-7 text-[14.5px] text-muted-foreground">Start your 7-day free trial. No credit card required.</p>

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

        <Button type="submit" variant="default" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Continue
        </Button>
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
