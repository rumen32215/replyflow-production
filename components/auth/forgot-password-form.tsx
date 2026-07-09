"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth";
import { toast } from "@/hooks/use-toast";

export function ForgotPasswordForm() {
  const supabase = createClient();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordInput) {
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setSubmitting(false);

    if (error) {
      toast({ variant: "destructive", title: "Something went wrong", description: error.message });
      return;
    }
    setSent(values.email);
  }

  if (sent) {
    return (
      <AuthCard>
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-primary">
            <MailCheck className="h-6 w-6" />
          </div>
          <h1 className="mb-2 text-[22px] font-extrabold tracking-tight">Check your email</h1>
          <p className="mb-7 text-[14.5px] text-muted-foreground">
            We&apos;ve sent a password reset link to <span className="font-semibold text-foreground">{sent}</span>.
          </p>
          <Link href="/login">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="h-4 w-4" /> Back to log in
            </Button>
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <h1 className="mb-1.5 text-[25px] font-extrabold tracking-tight">Reset your password</h1>
      <p className="mb-7 text-[14.5px] text-muted-foreground">
        Enter your email and we&apos;ll send you a link to reset it.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" placeholder="you@yourbusiness.com" {...register("email")} />
          {errors.email && <p className="text-xs font-medium text-destructive">{errors.email.message}</p>}
        </div>

        <Button type="submit" variant="default" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Send reset link
        </Button>
      </form>

      <Link
        href="/login"
        className="mt-6 flex items-center justify-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to log in
      </Link>
    </AuthCard>
  );
}
