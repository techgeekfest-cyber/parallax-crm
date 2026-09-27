"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useId } from "react";
import { Controller, useForm, type Path, type UseFormRegisterReturn } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FormError, FormField } from "@/components/form-field";
import { ConflictNotice } from "@/components/record-actions";
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
import { describeError, isApiError } from "@/lib/api/errors";
import { fromNumber, moneyString, optionalText, requiredText, toNumber, toText } from "@/lib/form-fields";

import { salesRepKeys, useCreateSalesRep, useUpdateSalesProfile, type SalesRep } from "./api";

const profileFields = {
  title: optionalText(120),
  department: optionalText(120),
  phone: optionalText(40),
  territory: optionalText(120),
  quota: moneyString({ label: "Quota" }),
};

const profileSchema = z.object(profileFields);
type ProfileValues = z.infer<typeof profileSchema>;

const createSchema = z.object({
  ...profileFields,
  firstName: requiredText("First name", 100),
  lastName: requiredText("Last name", 100),
  email: z.string().trim().min(1, "Email is required").pipe(z.email("Enter a valid email address")),
  role: z.enum(["SALES_REP", "SALES_MANAGER"]),
  password: z.string().min(12, "Use at least 12 characters").max(72, "Use at most 72 characters"),
});
type CreateValues = z.infer<typeof createSchema>;

function profileBody(values: ProfileValues) {
  return {
    title: toText(values.title),
    department: toText(values.department),
    phone: toText(values.phone),
    territory: toText(values.territory),
    quota: toNumber(values.quota) ?? 0,
  };
}

function applyFieldErrors<T extends Record<string, unknown>>(
  form: { setError: (name: Path<T> | "root", error: { message: string }, options?: { shouldFocus: boolean }) => void },
  error: unknown,
  fields: string[],
) {
  const fieldErrors = isApiError(error) ? error.fieldErrors.filter((e) => fields.includes(e.field)) : [];
  if (fieldErrors.length > 0) {
    fieldErrors.forEach((e, i) => form.setError(e.field as Path<T>, { message: e.message }, { shouldFocus: i === 0 }));
  } else {
    form.setError("root", { message: describeError(error) });
  }
}

/** Profile inputs shared by both dialogs; each form passes its own register and errors for these fields. */
function ProfileFields({
  id,
  register,
  errors,
}: {
  id: string;
  register: (name: keyof ProfileValues) => UseFormRegisterReturn;
  errors: Partial<Record<keyof ProfileValues, { message?: string }>>;
}) {
  const field = (name: keyof ProfileValues, label: string, props: React.ComponentProps<"input"> = {}) => (
    <FormField id={`${id}-${name}`} label={label} error={errors[name]?.message} optional={name !== "quota"}>
      <Input id={`${id}-${name}`} aria-invalid={!!errors[name]} {...register(name)} {...props} />
    </FormField>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {field("title", "Title", { placeholder: "e.g. Account Executive" })}
      {field("territory", "Territory", { placeholder: "e.g. EMEA" })}
      {field("department", "Department")}
      {field("phone", "Phone", { type: "tel" })}
      {field("quota", "Annual quota (USD)", { inputMode: "decimal", placeholder: "0" })}
    </div>
  );
}

export function EditSalesProfileDialog({ rep, onOpenChange }: { rep: SalesRep | null; onOpenChange: (open: boolean) => void }) {
  const update = useUpdateSalesProfile();
  const queryClient = useQueryClient();
  const id = useId();
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: rep
      ? {
          title: rep.title ?? "",
          department: rep.department ?? "",
          phone: rep.phone ?? "",
          territory: rep.territory ?? "",
          quota: fromNumber(rep.quota),
        }
      : undefined,
  });
  const { errors, isSubmitting } = form.formState;
  const conflict = isApiError(update.error, "CONFLICT");

  async function onSubmit(values: ProfileValues) {
    if (!rep) return;
    try {
      const saved = await update.mutateAsync({ id: rep.id, body: { ...profileBody(values), version: rep.profileVersion } });
      toast.success(`${saved.fullName}'s profile updated`);
      onOpenChange(false);
    } catch (error) {
      if (!isApiError(error, "CONFLICT")) applyFieldErrors<ProfileValues>(form, error, Object.keys(profileFields));
    }
  }

  return (
    <Dialog open={!!rep} onOpenChange={(open) => !isSubmitting && onOpenChange(open)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit sales profile</DialogTitle>
          <DialogDescription>{rep?.fullName} · YTD sales and attainment are calculated from closed deals.</DialogDescription>
        </DialogHeader>
        <form id={`${id}-form`} noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <ProfileFields id={id} register={(name) => form.register(name)} errors={errors} />
          {conflict ? (
            <ConflictNotice
              onReload={async () => {
                update.reset();
                await queryClient.invalidateQueries({ queryKey: salesRepKeys.all });
                onOpenChange(false);
              }}
            />
          ) : (
            <FormError message={errors.root?.message} />
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={`${id}-form`} disabled={isSubmitting || conflict}>
            {isSubmitting ? "Saving…" : "Save profile"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ROLE_ITEMS = { SALES_REP: "Sales rep", SALES_MANAGER: "Sales manager" };
const emptyCreate: CreateValues = {
  firstName: "",
  lastName: "",
  email: "",
  role: "SALES_REP",
  password: "",
  title: "",
  department: "",
  phone: "",
  territory: "",
  quota: "",
};

export function CreateSalesRepDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const create = useCreateSalesRep();
  const id = useId();
  const form = useForm<CreateValues>({ resolver: zodResolver(createSchema), defaultValues: emptyCreate });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: CreateValues) {
    try {
      const saved = await create.mutateAsync({
        ...profileBody(values),
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        role: values.role,
        password: values.password,
      });
      toast.success(`${saved.fullName} added to the sales team`, {
        description: "Share the temporary password with them securely.",
      });
      form.reset(emptyCreate);
      onOpenChange(false);
    } catch (error) {
      applyFieldErrors<CreateValues>(form, error, Object.keys(emptyCreate));
    }
  }

  const text = (name: keyof CreateValues, label: string, props: React.ComponentProps<"input"> = {}) => (
    <FormField id={`${id}-${name}`} label={label} error={errors[name]?.message}>
      <Input id={`${id}-${name}`} aria-invalid={!!errors[name]} {...form.register(name)} {...props} />
    </FormField>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add sales rep</DialogTitle>
          <DialogDescription>Creates their sign-in account and sales profile together.</DialogDescription>
        </DialogHeader>
        <form id={`${id}-form`} noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {text("firstName", "First name", { autoFocus: true })}
            {text("lastName", "Last name")}
            {text("email", "Email", { type: "email" })}
            <FormField id={`${id}-role`} label="Role" error={errors.role?.message}>
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <Select items={ROLE_ITEMS} value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                    <SelectTrigger id={`${id}-role`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_ITEMS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <div className="sm:col-span-2">
              {text("password", "Temporary password", { autoComplete: "new-password", className: "font-mono", spellCheck: false })}
            </div>
          </div>
          <ProfileFields id={id} register={(name) => form.register(name)} errors={errors} />
          <FormError message={errors.root?.message} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={`${id}-form`} disabled={isSubmitting}>
            {isSubmitting ? "Adding…" : "Add sales rep"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
