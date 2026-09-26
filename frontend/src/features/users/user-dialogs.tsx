"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useId } from "react";
import { Controller, useForm, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Role } from "@/features/auth/api";
import { ROLE_LABELS, ROLES } from "@/features/auth/roles";
import { describeError, isApiError } from "@/lib/api/errors";

import { useCreateUser, userKeys, useUpdateUser, type User } from "./api";

const roleSchema = z.enum(ROLES as [Role, ...Role[]], { error: "Choose a role" });
const name = (label: string) => z.string().trim().min(1, `${label} is required`).max(100, "Keep it under 100 characters");

const createSchema = z.object({
  firstName: name("First name"),
  lastName: name("Last name"),
  email: z.string().trim().min(1, "Email is required").pipe(z.email("Enter a valid email address")),
  role: roleSchema,
  password: z.string().min(12, "Use at least 12 characters").max(72, "Use at most 72 characters"),
});

const editSchema = z.object({
  firstName: name("First name"),
  lastName: name("Last name"),
  role: roleSchema,
  active: z.boolean(),
});

/** A readable temporary password: four random words' worth of entropy without ambiguous characters. */
function generatePassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return chars.match(/.{4}/g)!.join("-");
}

/** Server field errors land on the matching input; anything else becomes the form-level message. */
function applyServerErrors<T extends FieldValues>(form: UseFormReturn<T>, error: unknown, fields: readonly string[]) {
  const fieldErrors = isApiError(error) ? error.fieldErrors.filter((e) => fields.includes(e.field)) : [];
  if (fieldErrors.length > 0) {
    fieldErrors.forEach((e, i) => form.setError(e.field as Path<T>, { message: e.message }, { shouldFocus: i === 0 }));
  } else {
    form.setError("root", { message: describeError(error) });
  }
}

function RoleSelect({ id, value, onChange, disabled }: { id: string; value: Role | ""; onChange: (role: Role) => void; disabled?: boolean }) {
  return (
    <Select items={ROLE_LABELS} value={value || null} onValueChange={(v) => v && onChange(v as Role)} disabled={disabled}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Choose a role" />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((role) => (
          <SelectItem key={role} value={role}>
            {ROLE_LABELS[role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CreateUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createUser = useCreateUser();
  const id = useId();
  const empty = { firstName: "", lastName: "", email: "", role: "SALES_REP" as Role, password: "" };
  const form = useForm<z.infer<typeof createSchema>>({ resolver: zodResolver(createSchema), defaultValues: empty });
  const { errors, isSubmitting } = form.formState;

  function close(next: boolean) {
    if (isSubmitting) return;
    if (!next) form.reset(empty);
    onOpenChange(next);
  }

  async function onSubmit(values: z.infer<typeof createSchema>) {
    try {
      const user = await createUser.mutateAsync(values);
      toast.success(`${user.fullName} can now sign in`, {
        description: "Share the temporary password with them securely. They can change it in Account settings.",
      });
      form.reset(empty);
      onOpenChange(false);
    } catch (error) {
      applyServerErrors(form, error, Object.keys(empty));
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>They sign in with this email and the temporary password you set.</DialogDescription>
        </DialogHeader>
        <form id={`${id}-form`} noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id={`${id}-first`} label="First name" error={errors.firstName?.message}>
              <Input id={`${id}-first`} autoFocus aria-invalid={!!errors.firstName} {...form.register("firstName")} />
            </FormField>
            <FormField id={`${id}-last`} label="Last name" error={errors.lastName?.message}>
              <Input id={`${id}-last`} aria-invalid={!!errors.lastName} {...form.register("lastName")} />
            </FormField>
          </div>
          <FormField id={`${id}-email`} label="Email" error={errors.email?.message}>
            <Input id={`${id}-email`} type="email" aria-invalid={!!errors.email} {...form.register("email")} />
          </FormField>
          <FormField id={`${id}-role`} label="Role" error={errors.role?.message}>
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => <RoleSelect id={`${id}-role`} value={field.value} onChange={field.onChange} />}
            />
          </FormField>
          <FormField
            id={`${id}-password`}
            label="Temporary password"
            error={errors.password?.message}
            hint="At least 12 characters."
          >
            <div className="flex gap-2">
              <Input
                id={`${id}-password`}
                autoComplete="new-password"
                spellCheck={false}
                className="font-mono"
                aria-invalid={!!errors.password}
                {...form.register("password")}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => form.setValue("password", generatePassword(), { shouldValidate: true })}
              >
                Generate
              </Button>
            </div>
          </FormField>
          <FormError message={errors.root?.message} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={`${id}-form`} disabled={isSubmitting}>
            {isSubmitting ? "Adding…" : "Add user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditUserDialog({
  user,
  isSelf,
  onOpenChange,
}: {
  user: User | null;
  isSelf: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateUser = useUpdateUser();
  const queryClient = useQueryClient();
  const id = useId();
  const form = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    values: user
      ? { firstName: user.firstName, lastName: user.lastName, role: user.role, active: user.active }
      : undefined,
  });
  const { errors, isSubmitting } = form.formState;
  const conflict = isApiError(updateUser.error, "CONFLICT");

  async function onSubmit(values: z.infer<typeof editSchema>) {
    if (!user) return;
    try {
      const saved = await updateUser.mutateAsync({ id: user.id, body: { ...values, version: user.version } });
      const sessionsEnded = saved.role !== user.role || saved.active !== user.active;
      toast.success(`${saved.fullName} updated`, {
        description: sessionsEnded ? "Their open sessions were signed out so the change applies immediately." : undefined,
      });
      onOpenChange(false);
    } catch (error) {
      applyServerErrors(form, error, ["firstName", "lastName", "role", "active"]);
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(open) => !isSubmitting && onOpenChange(open)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>{user?.email}</DialogDescription>
        </DialogHeader>
        <form id={`${id}-form`} noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id={`${id}-first`} label="First name" error={errors.firstName?.message}>
              <Input id={`${id}-first`} aria-invalid={!!errors.firstName} {...form.register("firstName")} />
            </FormField>
            <FormField id={`${id}-last`} label="Last name" error={errors.lastName?.message}>
              <Input id={`${id}-last`} aria-invalid={!!errors.lastName} {...form.register("lastName")} />
            </FormField>
          </div>
          <FormField
            id={`${id}-role`}
            label="Role"
            error={errors.role?.message}
            hint={isSelf ? "You can't change your own role." : "Changing the role signs the user out everywhere."}
          >
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <RoleSelect id={`${id}-role`} value={field.value} onChange={field.onChange} disabled={isSelf} />
              )}
            />
          </FormField>
          <Controller
            control={form.control}
            name="active"
            render={({ field }) => (
              <label
                htmlFor={`${id}-active`}
                className="flex items-start justify-between gap-4 rounded-lg border p-3 has-disabled:opacity-60"
              >
                <span>
                  <span className="block text-sm font-medium">Active</span>
                  <span className="block text-xs text-muted-foreground">
                    {isSelf ? "You can't deactivate your own account." : "Inactive users can't sign in."}
                  </span>
                </span>
                <Switch id={`${id}-active`} checked={field.value} onCheckedChange={field.onChange} disabled={isSelf} />
              </label>
            )}
          />
          {conflict ? (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-destructive/10 px-3 py-2">
              <p className="text-sm text-destructive">Someone else changed this user while you were editing.</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  updateUser.reset();
                  form.clearErrors();
                  await queryClient.invalidateQueries({ queryKey: userKeys.all });
                  onOpenChange(false);
                }}
              >
                Reload
              </Button>
            </div>
          ) : (
            <FormError message={errors.root?.message} />
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={`${id}-form`} disabled={isSubmitting || conflict}>
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
