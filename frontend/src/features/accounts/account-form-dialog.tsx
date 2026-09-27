"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useId } from "react";
import { Controller, useForm, useWatch, type Path } from "react-hook-form";
import { toast } from "sonner";

import { FormError, FormField } from "@/components/form-field";
import { ConflictNotice } from "@/components/record-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/features/auth/api";
import { UserSelect } from "@/features/users/user-select";
import { describeError, isApiError } from "@/lib/api/errors";

import { accountKeys, useCreateAccount, useUpdateAccount, type Account, type AccountType } from "./api";
import { accountFormSchema, accountToForm, emptyAccountForm, toAccountRequest, type AccountFormValues } from "./account-form";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES, FUNDING_ROUND_LABELS, GROWTH_STAGE_LABELS } from "./labels";

/** Server field names ("enterprise.globalEmployeeCount") map onto form paths; "billingAddress.x" onto "billing.x". */
function formPath(field: string): Path<AccountFormValues> | undefined {
  const mapped = field.replace(/^billingAddress/, "billing").replace(/^shippingAddress/, "shipping");
  const known = ["type", "name", "industry", "website", "phone", "employeeCount", "annualRevenue", "ownerId"];
  if (known.includes(mapped) || /^(billing|shipping|enterprise|smb|startup)\.\w+$/.test(mapped)) {
    return mapped as Path<AccountFormValues>;
  }
  return undefined;
}

export function AccountFormDialog({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this account; omit to create one. */
  account?: Account;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = useId();
  const canAssign = usePermissions()?.accessAllSalesRecords ?? false;
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const editing = !!account;
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: emptyAccountForm(),
    values: account ? accountToForm(account) : undefined,
  });
  const { errors, isSubmitting } = form.formState;
  const type = useWatch({ control: form.control, name: "type" });
  const sameAsBilling = useWatch({ control: form.control, name: "shippingSameAsBilling" });
  const conflict = isApiError(update.error, "CONFLICT");

  function close(next: boolean) {
    if (isSubmitting) return;
    if (!next) {
      form.reset(account ? accountToForm(account) : emptyAccountForm());
      update.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: AccountFormValues) {
    try {
      const saved = account
        ? await update.mutateAsync({ id: account.id, body: toAccountRequest(values, account.version) })
        : await create.mutateAsync(toAccountRequest(values));
      toast.success(editing ? `${saved.name} updated` : `${saved.name} created`, {
        description: editing ? undefined : `Saved as ${saved.number}.`,
        action: editing ? undefined : { label: "View", onClick: () => router.push(`/accounts/${saved.id}`) },
      });
      if (!editing) form.reset(emptyAccountForm());
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

  const text = (name: Path<AccountFormValues>, label: string, props: React.ComponentProps<"input"> & { optional?: boolean } = {}) => {
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

  const address = (prefix: "billing" | "shipping") => (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">{text(`${prefix}.street`, "Street")}</div>
      {text(`${prefix}.city`, "City")}
      {text(`${prefix}.state`, "State / region")}
      {text(`${prefix}.postalCode`, "Postal code")}
      {text(`${prefix}.country`, "Country")}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit account" : "New account"}</DialogTitle>
          <DialogDescription>
            {editing
              ? `${account.number} · the account type can't be changed.`
              : "An organisation you sell to. Choose its type — it decides the tier and support rules."}
          </DialogDescription>
        </DialogHeader>

        <form id={`${id}-form`} noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id={`${id}-type`} label="Account type" error={errors.type?.message}>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select
                    items={ACCOUNT_TYPE_LABELS}
                    value={field.value}
                    onValueChange={(value) => value && field.onChange(value as AccountType)}
                    disabled={editing}
                  >
                    <SelectTrigger id={`${id}-type`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {ACCOUNT_TYPE_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            {text("name", "Account name", { optional: false, autoFocus: !editing })}
            {text("industry", "Industry")}
            {text("website", "Website", { placeholder: "example.com" })}
            {text("phone", "Phone", { type: "tel" })}
            {text("employeeCount", "Employees", { inputMode: "numeric" })}
            {text("annualRevenue", "Annual revenue (USD)", { inputMode: "decimal" })}
            {canAssign && (
              <FormField id={`${id}-owner`} label="Owner" optional hint="Leave empty to own it yourself.">
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
                      current={account?.owner}
                    />
                  )}
                />
              </FormField>
            )}
          </div>

          <fieldset className="grid gap-4 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">{ACCOUNT_TYPE_LABELS[type]} details</legend>
            {type === "ENTERPRISE" && (
              <div className="grid gap-4 sm:grid-cols-2">
                {text("enterprise.enterpriseId", "Enterprise ID")}
                {text("enterprise.globalEmployeeCount", "Global employees", { inputMode: "numeric" })}
                <FormField id={`${id}-manager`} label="Account manager" optional>
                  <Controller
                    control={form.control}
                    name="enterprise.accountManagerId"
                    render={({ field }) => (
                      <UserSelect
                        id={`${id}-manager`}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="None"
                        enabled={open && canAssign}
                        current={account?.accountManager}
                      />
                    )}
                  />
                </FormField>
                <Controller
                  control={form.control}
                  name="enterprise.hasEnterpriseSupport"
                  render={({ field }) => (
                    <label htmlFor={`${id}-support`} className="flex items-center justify-between gap-3 self-end rounded-lg border p-2.5">
                      <span className="text-sm">Enterprise support contract</span>
                      <Switch id={`${id}-support`} checked={field.value} onCheckedChange={field.onChange} />
                    </label>
                  )}
                />
                <div className="sm:col-span-2">
                  <FormField
                    id={`${id}-subsidiaries`}
                    label="Subsidiaries"
                    optional
                    hint="One per line."
                    error={errors.enterprise?.subsidiaries?.message}
                  >
                    <Textarea id={`${id}-subsidiaries`} rows={3} {...form.register("enterprise.subsidiaries")} />
                  </FormField>
                </div>
              </div>
            )}
            {type === "SMB" && (
              <div className="grid gap-4 sm:grid-cols-2">
                {text("smb.businessType", "Business type", { placeholder: "e.g. Bakery" })}
                {text("smb.yearsInBusiness", "Years in business", { inputMode: "numeric" })}
                {text("smb.ownerName", "Business owner")}
                <Controller
                  control={form.control}
                  name="smb.localBusiness"
                  render={({ field }) => (
                    <label htmlFor={`${id}-local`} className="flex items-center justify-between gap-3 self-end rounded-lg border p-2.5">
                      <span className="text-sm">Local business</span>
                      <Switch id={`${id}-local`} checked={field.value} onCheckedChange={field.onChange} />
                    </label>
                  )}
                />
              </div>
            )}
            {type === "STARTUP" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id={`${id}-round`} label="Funding round" optional>
                  <Controller
                    control={form.control}
                    name="startup.fundingRound"
                    render={({ field }) => (
                      <Select items={{ "": "Not set", ...FUNDING_ROUND_LABELS }} value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                        <SelectTrigger id={`${id}-round`} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Not set</SelectItem>
                          {Object.entries(FUNDING_ROUND_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
                {text("startup.totalFunding", "Total funding (USD)", { inputMode: "decimal" })}
                {text("startup.investorType", "Investor type", { placeholder: "e.g. Venture capital" })}
                {text("startup.monthsToProfitability", "Months to profitability", { inputMode: "numeric" })}
                <FormField id={`${id}-growth`} label="Growth stage" optional>
                  <Controller
                    control={form.control}
                    name="startup.growthStage"
                    render={({ field }) => (
                      <Select items={{ "": "Not set", ...GROWTH_STAGE_LABELS }} value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                        <SelectTrigger id={`${id}-growth`} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Not set</SelectItem>
                          {Object.entries(GROWTH_STAGE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
              </div>
            )}
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">Billing address</legend>
            {address("billing")}
          </fieldset>
          <fieldset className="grid gap-3">
            <legend className="mb-2 flex w-full items-center justify-between text-sm font-medium">Shipping address</legend>
            <Controller
              control={form.control}
              name="shippingSameAsBilling"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                  Same as billing address
                </label>
              )}
            />
            {!sameAsBilling && address("shipping")}
          </fieldset>

          {conflict ? (
            <ConflictNotice
              onReload={async () => {
                update.reset();
                if (account) await queryClient.invalidateQueries({ queryKey: accountKeys.detail(account.id) });
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
            {isSubmitting ? "Saving…" : editing ? "Save changes" : "Create account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
