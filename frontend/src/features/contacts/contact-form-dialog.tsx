"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useId } from "react";
import { Controller, useForm, type Path } from "react-hook-form";
import { toast } from "sonner";

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
import { Switch } from "@/components/ui/switch";
import { AccountPicker } from "@/features/accounts/account-picker";
import { usePermissions } from "@/features/auth/api";
import { UserSelect } from "@/features/users/user-select";
import { describeError, isApiError } from "@/lib/api/errors";

import { contactKeys, useCreateContact, useUpdateContact, type Contact } from "./api";
import {
  contactFormSchema,
  contactToForm,
  emptyContactForm,
  toContactRequest,
  type ContactFormOutput,
  type ContactFormValues,
} from "./contact-form";

function formPath(field: string): Path<ContactFormValues> | undefined {
  if (field === "accountId") return "account";
  const mapped = field.replace(/^mailingAddress/, "mailing");
  const known = ["firstName", "lastName", "email", "phone", "title", "department", "primary", "ownerId"];
  return known.includes(mapped) || /^mailing\.\w+$/.test(mapped) ? (mapped as Path<ContactFormValues>) : undefined;
}

export function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this contact; omit to create one. */
  contact?: Contact;
  /** Pre-selected account for a new contact (e.g. from an account page). */
  account?: { id: string; name: string };
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = useId();
  const canAssign = usePermissions()?.accessAllSalesRecords ?? false;
  const create = useCreateContact();
  const update = useUpdateContact();
  const editing = !!contact;
  const initial = contact ? contactToForm(contact) : emptyContactForm(account ?? null);
  const form = useForm<ContactFormValues, unknown, ContactFormOutput>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: initial,
    values: contact ? contactToForm(contact) : undefined,
  });
  const { errors, isSubmitting } = form.formState;
  const conflict = isApiError(update.error, "CONFLICT");

  function close(next: boolean) {
    if (isSubmitting) return;
    if (!next) {
      form.reset(initial);
      update.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: ContactFormOutput) {
    try {
      const saved = contact
        ? await update.mutateAsync({ id: contact.id, body: toContactRequest(values, contact.version) })
        : await create.mutateAsync(toContactRequest(values));
      toast.success(editing ? `${saved.fullName} updated` : `${saved.fullName} added to ${saved.account.name}`, {
        description: saved.primary && !contact?.primary ? "Now the account's primary contact." : undefined,
        action: editing ? undefined : { label: "View", onClick: () => router.push(`/contacts/${saved.id}`) },
      });
      if (!editing) form.reset(emptyContactForm(account ?? null));
      onOpenChange(false);
    } catch (error) {
      if (isApiError(error, "CONFLICT")) return;
      const fieldErrors = isApiError(error)
        ? error.fieldErrors.map((e) => ({ path: formPath(e.field), message: e.message })).filter((e) => e.path)
        : [];
      if (fieldErrors.length > 0) {
        fieldErrors.forEach((e, i) => form.setError(e.path!, { message: e.message }, { shouldFocus: i === 0 }));
      } else {
        form.setError("root", { message: describeError(error) });
      }
    }
  }

  const text = (name: Path<ContactFormValues>, label: string, props: React.ComponentProps<"input"> & { optional?: boolean } = {}) => {
    const { optional = true, ...inputProps } = props;
    const error = name.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], errors) as
      | { message?: string }
      | undefined;
    return (
      <FormField id={`${id}-${name}`} label={label} error={error?.message} optional={optional}>
        <Input id={`${id}-${name}`} aria-invalid={!!error} {...form.register(name)} {...inputProps} />
      </FormField>
    );
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit contact" : "New contact"}</DialogTitle>
          <DialogDescription>{editing ? contact.number : "A person at one of your accounts."}</DialogDescription>
        </DialogHeader>

        <form id={`${id}-form`} noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <FormField id={`${id}-account`} label="Account" error={errors.account?.message}>
            <Controller
              control={form.control}
              name="account"
              render={({ field }) => (
                <AccountPicker
                  id={`${id}-account`}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  invalid={!!errors.account}
                  disabled={!!account && !editing}
                />
              )}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            {text("firstName", "First name", { optional: false, autoComplete: "off", autoFocus: true })}
            {text("lastName", "Last name", { optional: false, autoComplete: "off" })}
            {text("email", "Email", { type: "email" })}
            {text("phone", "Phone", { type: "tel" })}
            {text("title", "Title", { placeholder: "e.g. Head of Procurement" })}
            {text("department", "Department")}
          </div>
          <Controller
            control={form.control}
            name="primary"
            render={({ field }) => (
              <label htmlFor={`${id}-primary`} className="flex items-start justify-between gap-4 rounded-lg border p-3">
                <span>
                  <span className="block text-sm font-medium">Primary contact</span>
                  <span className="block text-xs text-muted-foreground">
                    Each account has one. Choosing this contact replaces the current primary contact.
                  </span>
                </span>
                <Switch id={`${id}-primary`} checked={field.value} onCheckedChange={field.onChange} />
              </label>
            )}
          />
          {canAssign && (
            <FormField id={`${id}-owner`} label="Owner" optional hint={editing ? undefined : "Leave empty to own it yourself."}>
              <Controller
                control={form.control}
                name="ownerId"
                render={({ field }) => (
                  <UserSelect
                    id={`${id}-owner`}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={editing ? "Unchanged" : "Me"}
                    enabled={open}
                    current={contact?.owner}
                  />
                )}
              />
            </FormField>
          )}
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-medium">Mailing address</legend>
            <div className="sm:col-span-2">{text("mailing.street", "Street")}</div>
            {text("mailing.city", "City")}
            {text("mailing.state", "State / region")}
            {text("mailing.postalCode", "Postal code")}
            {text("mailing.country", "Country")}
          </fieldset>

          {conflict ? (
            <ConflictNotice
              onReload={async () => {
                update.reset();
                if (contact) await queryClient.invalidateQueries({ queryKey: contactKeys.detail(contact.id) });
                onOpenChange(false);
              }}
            />
          ) : (
            <FormError message={errors.root?.message} />
          )}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={`${id}-form`} disabled={isSubmitting || conflict}>
            {isSubmitting ? "Saving…" : editing ? "Save changes" : "Create contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
