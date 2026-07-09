"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validations/settings";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const RULES = [
  { test: (v: string) => v.length >= 8, label: "At least 8 characters" },
  { test: (v: string) => /[A-Z]/.test(v), label: "One uppercase letter" },
  { test: (v: string) => /[0-9]/.test(v), label: "One number" },
];

export function SettingsPasswordForm() {
  const supabase = createClient();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema), mode: "onChange" });

  const newPassword = watch("newPassword") || "";

  async function onSubmit(values: ChangePasswordInput) {
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: values.newPassword });
    setSubmitting(false);

    if (error) {
      toast({ variant: "destructive", title: "Couldn't update password", description: error.message });
      return;
    }
    toast({ variant: "success", title: "Password updated" });
    reset();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">New password</Label>
        <Input id="newPassword" type="password" placeholder="At least 8 characters" {...register("newPassword")} />

        <ul className="grid grid-cols-1 gap-1 pt-1 sm:grid-cols-3">
          {RULES.map((rule) => {
            const met = rule.test(newPassword);
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

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input id="confirmPassword" type="password" placeholder="••••••••" {...register("confirmPassword")} />
        {errors.confirmPassword && (
          <p className="text-xs font-medium text-destructive">{errors.confirmPassword.message}</p>
        )}
      </div>

      <Button type="submit" variant="outline" disabled={submitting} className="w-auto px-6">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Update password
      </Button>
    </form>
  );
}
