"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { toast } from "@/hooks/use-toast";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";

function hasFragmentSession() {
  return typeof window !== "undefined" && window.location.hash.includes("access_token");
}

export function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Supabase's email-confirmation link sometimes redirects here with the
  // session in the URL fragment (#access_token=...) instead of a
  // /auth/callback ?code= — a fragment only the browser ever sees, so
  // the server-side code exchange never fires. Rather than ask someone
  // who just proved ownership of their email to type a password too,
  // complete that session client-side and send them to "/", which
  // resolves to wherever they actually belong. Lazily initialised so a
  // normal login visit (no fragment) never renders this state at all,
  // not even for one frame.
  const [completingSignIn, setCompletingSignIn] = useState(hasFragmentSession);

  useEffect(() => {
    if (!completingSignIn) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (!access_token || !refresh_token) {
      setCompletingSignIn(false);
      return;
    }
    supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      window.history.replaceState(null, "", window.location.pathname);
      if (error) {
        setCompletingSignIn(false);
        return;
      }
      router.replace("/");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword(values);
    setSubmitting(false);

    if (error) {
      toast({ variant: "destructive", title: "Couldn't log in", description: error.message });
      return;
    }
    router.push("/");
    router.refresh();
  }

  if (completingSignIn) {
    return (
      <AuthCard>
        <div className="flex flex-col items-center py-8 text-center">
          <Loader2 className="mb-3 h-5 w-5 animate-spin text-primary" />
          <p className="text-[14.5px] text-muted-foreground">Signing you in&hellip;</p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <h1 className="mb-1.5 text-[25px] font-extrabold tracking-tight">Welcome back.</h1>
      <p className="mb-7 text-[14.5px] text-muted-foreground">Let&apos;s see how things are going.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" placeholder="you@yourbusiness.com" {...register("email")} />
          {errors.email && <p className="text-xs font-medium text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
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
          {errors.password && <p className="text-xs font-medium text-destructive">{errors.password.message}</p>}
        </div>

        <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Log in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        {/* V19 — same fresh-start reasoning as the landing page's own
         * CTA: never clicked mid-flow, so it's safe to reset the
         * onboarding store here; the destination is the first real
         * question now, not the credential screen. */}
        <Link
          href="/hire/name"
          onClick={() => useOnboardingStore.getState().reset()}
          className="font-semibold text-primary hover:underline"
        >
          Start free trial
        </Link>
      </p>
    </AuthCard>
  );
}
