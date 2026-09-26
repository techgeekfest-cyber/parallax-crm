"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useId } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describeError, isApiError } from "@/lib/api/errors";
import { safeNextPath } from "@/lib/safe-redirect";

import { useLogin } from "./api";

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email").pipe(z.email("Enter a valid email address")),
  password: z.string().min(1, "Enter your password"),
});

type Values = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const login = useLogin();
  const id = useId();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: Values) {
    try {
      await login.mutateAsync(values);
      router.replace(next);
    } catch (error) {
      form.setError("root", {
        message: isApiError(error, "UNAUTHENTICATED") ? "Email or password is incorrect." : describeError(error),
      });
      form.resetField("password", { keepError: false });
      form.setFocus("password");
    }
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-email`}>Email</Label>
        <Input
          id={`${id}-email`}
          type="email"
          autoComplete="username"
          autoFocus
          aria-invalid={!!errors.email}
          {...form.register("email")}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-password`}>Password</Label>
        <Input
          id={`${id}-password`}
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...form.register("password")}
        />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>

      {errors.root && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors.root.message}
        </p>
      )}

      <Button type="submit" size="lg" className="mt-1 w-full" disabled={isSubmitting}>
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
