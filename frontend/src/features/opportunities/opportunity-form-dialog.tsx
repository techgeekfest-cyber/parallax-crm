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
import { Textarea } from "@/components/ui/textarea";
import { AccountPicker } from "@/features/accounts/account-picker";
import { usePermissions } from "@/features/auth/api";
import { LEAD_SOURCE_LABELS } from "@/features/leads/labels";
import { UserSelect } from "@/features/users/user-select";
import { describeError, isApiError } from "@/lib/api/errors";

import { opportunityKeys, useCreateOpportunity, useUpdateOpportunity, type Opportunity, type OpportunityStage } from "./api";
import { isClosed, OPPORTUNITY_TYPE_LABELS, STAGE_DEFAULT_PROBABILITY, STAGE_LABELS, STAGES } from "./labels";
import { StageBadge } from "./stage-badge";
import {
  emptyOpportunityForm,
  opportunityFormSchema,
  opportunityToForm,
  toOpportunityRequest,
  type OpportunityFormOutput,
  type OpportunityFormValues,
} from "./opportunity-form";

function formPath(field: string): Path<OpportunityFormValues> | undefined {
  if (field === "accountId") return "account";
  const known = ["name", "amount", "stage", "probability", "closeDate", "type", "leadSource", "nextStep", "description", "ownerId"];
  return known.includes(field) ? (field as Path<OpportunityFormValues>) : undefined;
}

function OptionalEnumSelect({ id, items, value, onChange }: { id: string; items: Record<string, string>; value: string; onChange: (v: string) => void }) {
  return (
    <Select items={{ "": "Not set", ...items }} value={value} onValueChange={(next) => onChange(next ?? "")}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">Not set</SelectItem>
        {Object.entries(items).map(([itemValue, label]) => (
          <SelectItem key={itemValue} value={itemValue}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function OpportunityFormDialog({
  open,
  onOpenChange,
  opportunity,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity?: Opportunity;
  /** Pre-selected account for a new opportunity. */
  account?: { id: string; name: string };
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = useId();
  const canAssign = usePermissions()?.accessAllSalesRecords ?? false;
  const create = useCreateOpportunity();
  const update = useUpdateOpportunity();
  const editing = !!opportunity;
  const initial = opportunity ? opportunityToForm(opportunity) : emptyOpportunityForm(account ?? null);
  const form = useForm<OpportunityFormValues, unknown, OpportunityFormOutput>({
    resolver: zodResolver(opportunityFormSchema),
    defaultValues: initial,
    values: opportunity ? opportunityToForm(opportunity) : undefined,
  });
  const { errors, isSubmitting } = form.formState;
  const stage = useWatch({ control: form.control, name: "stage" }) as OpportunityStage;
  const conflict = isApiError(update.error, "CONFLICT");

  function close(next: boolean) {
    if (isSubmitting) return;
    if (!next) {
      form.reset(initial);
      update.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: OpportunityFormOutput) {
    try {
      const saved = opportunity
        ? await update.mutateAsync({ id: opportunity.id, body: toOpportunityRequest(values, opportunity.version) })
        : await create.mutateAsync(toOpportunityRequest(values));
      toast.success(editing ? `${saved.name} updated` : `${saved.name} created`, {
        description: editing ? undefined : `Saved as ${saved.number} on ${saved.account.name}.`,
        action: editing ? undefined : { label: "View", onClick: () => router.push(`/opportunities/${saved.id}`) },
      });
      if (!editing) form.reset(emptyOpportunityForm(account ?? null));
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

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit opportunity" : "New opportunity"}</DialogTitle>
          <DialogDescription>{editing ? opportunity.number : "A potential deal with one of your accounts."}</DialogDescription>
        </DialogHeader>

        <form id={`${id}-form`} noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <FormField id={`${id}-name`} label="Opportunity name" error={errors.name?.message}>
            <Input id={`${id}-name`} autoFocus={!editing} aria-invalid={!!errors.name} {...form.register("name")} />
          </FormField>
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
            <FormField id={`${id}-amount`} label="Amount (USD)" error={errors.amount?.message}>
              <Input id={`${id}-amount`} inputMode="decimal" aria-invalid={!!errors.amount} {...form.register("amount")} />
            </FormField>
            <FormField id={`${id}-close`} label="Expected close date" error={errors.closeDate?.message}>
              <Input id={`${id}-close`} type="date" aria-invalid={!!errors.closeDate} {...form.register("closeDate")} />
            </FormField>
            {editing ? (
              <div className="grid gap-1.5">
                <p className="text-sm leading-none font-medium">Stage</p>
                <div className="flex h-8 items-center">
                  <StageBadge stage={opportunity.stage} />
                </div>
                <p className="text-xs text-muted-foreground">Change the stage with the stage controls on the opportunity.</p>
              </div>
            ) : (
              <FormField id={`${id}-stage`} label="Stage" error={errors.stage?.message}>
                <Controller
                  control={form.control}
                  name="stage"
                  render={({ field }) => (
                    <Select
                      items={STAGE_LABELS}
                      value={field.value}
                      onValueChange={(value) => {
                        if (!value) return;
                        field.onChange(value);
                        // A new stage suggests its default probability; the user can still override it.
                        form.setValue("probability", String(STAGE_DEFAULT_PROBABILITY[value as OpportunityStage]));
                      }}
                    >
                      <SelectTrigger id={`${id}-stage`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {STAGE_LABELS[value]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
            )}
            <FormField
              id={`${id}-probability`}
              label="Probability (%)"
              optional
              error={errors.probability?.message}
              hint={isClosed(stage) ? `Always ${STAGE_DEFAULT_PROBABILITY[stage]}% when closed.` : `Defaults to ${STAGE_DEFAULT_PROBABILITY[stage]}% at this stage.`}
            >
              <Input
                id={`${id}-probability`}
                inputMode="numeric"
                disabled={isClosed(stage)}
                placeholder={String(STAGE_DEFAULT_PROBABILITY[stage])}
                aria-invalid={!!errors.probability}
                {...form.register("probability")}
              />
            </FormField>
            <FormField id={`${id}-type`} label="Type" optional>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <OptionalEnumSelect id={`${id}-type`} items={OPPORTUNITY_TYPE_LABELS} value={field.value} onChange={field.onChange} />
                )}
              />
            </FormField>
            <FormField id={`${id}-source`} label="Lead source" optional>
              <Controller
                control={form.control}
                name="leadSource"
                render={({ field }) => (
                  <OptionalEnumSelect id={`${id}-source`} items={LEAD_SOURCE_LABELS} value={field.value} onChange={field.onChange} />
                )}
              />
            </FormField>
          </div>
          <FormField id={`${id}-next`} label="Next step" optional error={errors.nextStep?.message}>
            <Input id={`${id}-next`} placeholder="e.g. Security review on Friday" {...form.register("nextStep")} />
          </FormField>
          <FormField id={`${id}-description`} label="Description" optional error={errors.description?.message}>
            <Textarea id={`${id}-description`} rows={3} {...form.register("description")} />
          </FormField>
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
                    current={opportunity?.owner}
                  />
                )}
              />
            </FormField>
          )}

          {conflict ? (
            <ConflictNotice
              onReload={async () => {
                update.reset();
                if (opportunity) await queryClient.invalidateQueries({ queryKey: opportunityKeys.detail(opportunity.id) });
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
            {isSubmitting ? "Saving…" : editing ? "Save changes" : "Create opportunity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
