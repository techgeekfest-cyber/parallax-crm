"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FormError, FormField } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { Avatar } from "@/components/shell/user-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useChangePassword, useMe } from "@/features/auth/api";
import { RoleBadge } from "@/features/users/role-badge";
import { describeError, isApiError } from "@/lib/api/errors";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(12, "Use at least 12 characters").max(72, "Use at most 72 characters"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });

type PasswordValues = z.infer<typeof passwordSchema>;
const emptyPasswords: PasswordValues = { currentPassword: "", newPassword: "", confirmPassword: "" };

export function AccountView() {
  const { data: me } = useMe();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <PageHeader title="Account settings" description="Your profile and sign-in security." />
      <div className="mt-6 grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your name, email and role are managed by an administrator.</CardDescription>
          </CardHeader>
          <CardContent>
            {me ? (
              <div className="flex items-center gap-4">
                <Avatar name={me.fullName} className="size-12 text-sm" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{me.fullName}</span>
                    <RoleBadge role={me.role} />
                  </div>
                  <div className="truncate text-sm text-muted-foreground">{me.email}</div>
                </div>
              </div>
            ) : (
              <Skeleton className="h-12 w-72" />
            )}
          </CardContent>
        </Card>
        <ChangePasswordCard />
      </div>
    </div>
  );
}

function ChangePasswordCard() {
  const changePassword = useChangePassword();
  const id = useId();
  const form = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema), defaultValues: emptyPasswords });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit({ currentPassword, newPassword }: PasswordValues) {
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      form.reset(emptyPasswords);
      toast.success("Password changed", { description: "You were signed out on every other device." });
    } catch (error) {
      const fieldError = isApiError(error) ? error.fieldErrors[0] : undefined;
      if (fieldError && (fieldError.field === "currentPassword" || fieldError.field === "newPassword")) {
        form.setError(fieldError.field, { message: fieldError.message }, { shouldFocus: true });
      } else {
        form.setError("root", { message: describeError(error) });
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>Use at least 12 characters. Changing it signs you out everywhere else.</CardDescription>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid max-w-sm gap-4">
          <FormField id={`${id}-current`} label="Current password" error={errors.currentPassword?.message}>
            <Input id={`${id}-current`} type="password" autoComplete="current-password" {...form.register("currentPassword")} />
          </FormField>
          <FormField id={`${id}-new`} label="New password" error={errors.newPassword?.message}>
            <Input id={`${id}-new`} type="password" autoComplete="new-password" {...form.register("newPassword")} />
          </FormField>
          <FormField id={`${id}-confirm`} label="Confirm new password" error={errors.confirmPassword?.message}>
            <Input id={`${id}-confirm`} type="password" autoComplete="new-password" {...form.register("confirmPassword")} />
          </FormField>
          <FormError message={errors.root?.message} />
          <div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
