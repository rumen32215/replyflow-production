"use client";

import { useState } from "react";
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

export function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <AuthCard>
      <h1 className="mb-1.5 text-[25px] font-extrabold tracking-tight">Welcome back</h1>
      <p className="mb-7 text-[14.5px] text-muted-foreground">Log in to your ReplyFlow account.</p>

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

        <Button type="submit" variant="default" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Log in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-primary hover:underline">
          Start free trial
        </Link>
      </p>
    </AuthCard>
  );
}
