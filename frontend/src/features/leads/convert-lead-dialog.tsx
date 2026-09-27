"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2Icon, CheckCircle2Icon, CheckIcon, ContactRoundIcon, HandshakeIcon } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";

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
import { AccountPicker } from "@/features/accounts/account-picker";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES } from "@/features/accounts/labels";
import { OPEN_STAGES, OPPORTUNITY_TYPE_LABELS, STAGE_LABELS } from "@/features/opportunities/labels";
import { describeError, isApiError } from "@/lib/api/errors";
import { formatCalendarDate, formatCurrency } from "@/lib/format";
import { toNumber } from "@/lib/form-fields";
import { cn } from "@/lib/utils";

import { useConvertLead, type Lead, type LeadConversionResult } from "./api";
import {
  CONVERSION_STEPS,
  conversionDefaults,
  conversionFormSchema,
  formPathForField,
  STEP_FIELDS,
  stepForField,
  toConversionRequest,
  type ConversionFormOutput,
  type ConversionFormValues,
  type ConversionStep,
} from "./conversion-form";

const STEP_LABELS: Record<ConversionStep, string> = {
  account: "Account",
  contact: "Contact",
  opportunity: "Opportunity",
  review: "Review",
};

const OPEN_STAGE_ITEMS = Object.fromEntries(OPEN_STAGES.map((stage) => [stage, STAGE_LABELS[stage]]));

/**
 * Converts a qualified lead in four steps — account, contact, opportunity, review — then shows what was created.
 * Nothing is saved until "Convert lead"; the server creates everything in one transaction or nothing at all.
 */
export function ConvertLeadDialog({ lead, open, onOpenChange }: { lead: Lead; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [result, setResult] = useState<LeadConversionResult | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setResult(null);
      }}
    >
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        {result ? (
          <ConversionSummary result={result} onDone={() => onOpenChange(false)} />
        ) : (
          <ConversionWizard key={`${lead.id}-${open}`} lead={lead} onCancel={() => onOpenChange(false)} onConverted={setResult} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConversionWizard({ lead, onCancel, onConverted }: { lead: Lead; onCancel: () => void; onConverted: (result: LeadConversionResult) => void }) {
  const id = useId();
  const convert = useConvertLead();
  const [step, setStep] = useState<ConversionStep>("account");
  const [reached, setReached] = useState(0);
  const form = useForm<ConversionFormValues, unknown, ConversionFormOutput>({
    resolver: zodResolver(conversionFormSchema),
    defaultValues: conversionDefaults(lead),
    mode: "onTouched",
  });
  const { errors, isSubmitting } = form.formState;
  const values = useWatch({ control: form.control }) as ConversionFormValues;
  const stepIndex = CONVERSION_STEPS.indexOf(step);
  const blocked = isApiError(convert.error, "ALREADY_CONVERTED") || isApiError(convert.error, "CONFLICT");

  function goTo(next: ConversionStep) {
    setStep(next);
    setReached((current) => Math.max(current, CONVERSION_STEPS.indexOf(next)));
  }

  async function next() {
    if (step === "review") return;
    const valid = await form.trigger(STEP_FIELDS[step] as unknown as FieldPath<ConversionFormValues>[], { shouldFocus: true });
    if (valid) goTo(CONVERSION_STEPS[stepIndex + 1]);
  }

  async function onSubmit(output: ConversionFormOutput) {
    try {
      onConverted(await convert.mutateAsync({ id: lead.id, body: toConversionRequest(output, lead.version) }));
    } catch (error) {
      if (!isApiError(error)) {
        form.setError("root", { message: describeError(error) });
        return;
      }
      const fieldErrors = error.fieldErrors
        .map((e) => ({ path: formPathForField(e.field), step: stepForField(e.field), message: e.message }))
        .filter((e) => e.path && e.step);
      if (fieldErrors.length > 0) {
        fieldErrors.forEach((e) => form.setError(e.path as FieldPath<ConversionFormValues>, { message: e.message }));
        setStep(fieldErrors[0].step!);
      } else {
        form.setError("root", { message: error.message });
      }
    }
  }

  // Client-side validation failing on submit (e.g. after editing an earlier step): show the first step with an error.
  function onInvalid(invalid: typeof errors) {
    const first = CONVERSION_STEPS.find((s) => s !== "review" && STEP_FIELDS[s].some((field) => field in invalid));
    if (first) setStep(first);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Convert lead</DialogTitle>
        <DialogDescription>
          {lead.fullName} at {lead.company} becomes an account, a contact and an opportunity. Review each step — nothing is
          saved until you convert.
        </DialogDescription>
      </DialogHeader>

      <nav aria-label="Conversion steps">
        <ol className="grid grid-cols-4 gap-2">
          {CONVERSION_STEPS.map((s, index) => {
            const done = index < stepIndex;
            const current = s === step;
            const reachable = index <= reached && !isSubmitting;
            return (
              <li key={s}>
                <button
                  type="button"
                  disabled={!reachable}
                  aria-current={current ? "step" : undefined}
                  onClick={() => reachable && setStep(s)}
                  className={cn(
                    "flex w-full items-center gap-2 border-t-2 pt-2 text-left text-xs font-medium transition-colors",
                    current ? "border-primary text-foreground" : done ? "border-primary/40 text-muted-foreground" : "border-border text-muted-foreground",
                    reachable && !current && "hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full text-[10px]",
                      current ? "bg-primary text-primary-foreground" : done ? "bg-primary/15 text-primary" : "bg-muted",
                    )}
                  >
                    {done ? <CheckIcon className="size-3" /> : index + 1}
                  </span>
                  {STEP_LABELS[s]}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <form id={`${id}-form`} noValidate onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="grid gap-4">
        {step === "account" && (
          <fieldset className="grid gap-4">
            <legend className="sr-only">Account</legend>
            <Controller
              control={form.control}
              name="accountMode"
              render={({ field }) => (
                <div role="radiogroup" aria-label="Account" className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      ["new", "Create a new account", `From “${lead.company}”.`],
                      ["existing", "Use an existing account", "Add the contact and deal to an account you already have."],
                    ] as const
                  ).map(([value, title, description]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={field.value === value}
                      onClick={() => field.onChange(value)}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors",
                        field.value === value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted",
                      )}
                    >
                      <span className="block text-sm font-medium">{title}</span>
                      <span className="block text-xs text-muted-foreground">{description}</span>
                    </button>
                  ))}
                </div>
              )}
            />
            {values.accountMode === "existing" ? (
              <FormField id={`${id}-existing`} label="Existing account" error={errors.existingAccount?.message}>
                <Controller
                  control={form.control}
                  name="existingAccount"
                  render={({ field }) => (
                    <AccountPicker id={`${id}-existing`} value={field.value ?? null} onChange={field.onChange} invalid={!!errors.existingAccount} />
                  )}
                />
              </FormField>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id={`${id}-account-name`} label="Account name" error={errors.account?.name?.message}>
                  <Input id={`${id}-account-name`} aria-invalid={!!errors.account?.name} {...form.register("account.name")} />
                </FormField>
                <FormField id={`${id}-account-type`} label="Account type">
                  <Controller
                    control={form.control}
                    name="account.type"
                    render={({ field }) => (
                      <Select items={ACCOUNT_TYPE_LABELS} value={field.value} onValueChange={(value) => value && field.onChange(value)}>
                        <SelectTrigger id={`${id}-account-type`} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACCOUNT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {ACCOUNT_TYPE_LABELS[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
                <FormField id={`${id}-account-website`} label="Website" optional error={errors.account?.website?.message}>
                  <Input id={`${id}-account-website`} placeholder="https://" {...form.register("account.website")} />
                </FormField>
                <FormField id={`${id}-account-industry`} label="Industry" optional error={errors.account?.industry?.message}>
                  <Input id={`${id}-account-industry`} {...form.register("account.industry")} />
                </FormField>
                <FormField id={`${id}-account-phone`} label="Account phone" optional error={errors.account?.phone?.message}>
                  <Input id={`${id}-account-phone`} type="tel" {...form.register("account.phone")} />
                </FormField>
              </div>
            )}
          </fieldset>
        )}

        {step === "contact" && (
          <fieldset className="grid gap-4">
            <legend className="sr-only">Contact</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id={`${id}-first`} label="First name" error={errors.contact?.firstName?.message}>
                <Input id={`${id}-first`} aria-invalid={!!errors.contact?.firstName} {...form.register("contact.firstName")} />
              </FormField>
              <FormField id={`${id}-last`} label="Last name" error={errors.contact?.lastName?.message}>
                <Input id={`${id}-last`} aria-invalid={!!errors.contact?.lastName} {...form.register("contact.lastName")} />
              </FormField>
              <FormField id={`${id}-email`} label="Email" optional error={errors.contact?.email?.message}>
                <Input id={`${id}-email`} type="email" aria-invalid={!!errors.contact?.email} {...form.register("contact.email")} />
              </FormField>
              <FormField id={`${id}-phone`} label="Phone" optional error={errors.contact?.phone?.message}>
                <Input id={`${id}-phone`} type="tel" {...form.register("contact.phone")} />
              </FormField>
              <FormField id={`${id}-title`} label="Title" optional error={errors.contact?.title?.message}>
                <Input id={`${id}-title`} placeholder="e.g. Head of Procurement" {...form.register("contact.title")} />
              </FormField>
            </div>
            <Controller
              control={form.control}
              name="contact.primary"
              render={({ field }) => (
                <label htmlFor={`${id}-primary`} className="flex items-start justify-between gap-4 rounded-lg border p-3">
                  <span>
                    <span className="block text-sm font-medium">Primary contact</span>
                    <span className="block text-xs text-muted-foreground">
                      {values.accountMode === "existing"
                        ? "Replaces the account's current primary contact."
                        : "The main person at the new account."}
                    </span>
                  </span>
                  <Switch id={`${id}-primary`} checked={field.value} onCheckedChange={field.onChange} />
                </label>
              )}
            />
          </fieldset>
        )}

        {step === "opportunity" && (
          <fieldset className="grid gap-4">
            <legend className="sr-only">Opportunity</legend>
            <FormField id={`${id}-opp-name`} label="Opportunity name" error={errors.opportunity?.name?.message}>
              <Input id={`${id}-opp-name`} aria-invalid={!!errors.opportunity?.name} {...form.register("opportunity.name")} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id={`${id}-amount`} label="Amount (USD)" error={errors.opportunity?.amount?.message}>
                <Input id={`${id}-amount`} inputMode="decimal" aria-invalid={!!errors.opportunity?.amount} {...form.register("opportunity.amount")} />
              </FormField>
              <FormField id={`${id}-close`} label="Expected close date" error={errors.opportunity?.closeDate?.message}>
                <Input id={`${id}-close`} type="date" aria-invalid={!!errors.opportunity?.closeDate} {...form.register("opportunity.closeDate")} />
              </FormField>
              <FormField id={`${id}-stage`} label="Starting stage" error={errors.opportunity?.stage?.message}>
                <Controller
                  control={form.control}
                  name="opportunity.stage"
                  render={({ field }) => (
                    <Select items={OPEN_STAGE_ITEMS} value={field.value} onValueChange={(value) => value && field.onChange(value)}>
                      <SelectTrigger id={`${id}-stage`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPEN_STAGES.map((stage) => (
                          <SelectItem key={stage} value={stage}>
                            {STAGE_LABELS[stage]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              <FormField id={`${id}-type`} label="Type" optional>
                <Controller
                  control={form.control}
                  name="opportunity.type"
                  render={({ field }) => (
                    <Select items={{ "": "Not set", ...OPPORTUNITY_TYPE_LABELS }} value={field.value} onValueChange={(value) => field.onChange(value ?? "")}>
                      <SelectTrigger id={`${id}-type`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Not set</SelectItem>
                        {Object.entries(OPPORTUNITY_TYPE_LABELS).map(([value, label]) => (
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
            <FormField id={`${id}-next`} label="Next step" optional error={errors.opportunity?.nextStep?.message}>
              <Input id={`${id}-next`} placeholder="e.g. Demo for the buying committee" {...form.register("opportunity.nextStep")} />
            </FormField>
          </fieldset>
        )}

        {step === "review" && <Review values={values} onEdit={setStep} />}

        {isApiError(convert.error, "ALREADY_CONVERTED") ? (
          <FormError message="This lead has already been converted — perhaps in another tab. Close this dialog to see where it went." />
        ) : isApiError(convert.error, "CONFLICT") ? (
          <FormError message="This lead changed while you were reviewing it. Close this dialog and try again with the latest version." />
        ) : (
          <FormError message={errors.root?.message} />
        )}
      </form>

      <DialogFooter>
        <Button variant="outline" onClick={() => (stepIndex === 0 ? onCancel() : setStep(CONVERSION_STEPS[stepIndex - 1]))} disabled={isSubmitting}>
          {stepIndex === 0 ? "Cancel" : "Back"}
        </Button>
        {/*
          Distinct keys: if React reused one <button> for both, clicking "Next" on the last step would re-render it as
          the submit button before the browser's default click action runs — converting without the review step.
        */}
        {step === "review" ? (
          <Button key="convert" type="submit" form={`${id}-form`} disabled={isSubmitting || blocked}>
            {isSubmitting ? "Converting…" : "Convert lead"}
          </Button>
        ) : (
          <Button key="next" type="button" onClick={next}>
            Next
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

function Review({ values, onEdit }: { values: ConversionFormValues; onEdit: (step: ConversionStep) => void }) {
  const amount = toNumber(values.opportunity.amount ?? "");
  const sections = [
    {
      step: "account" as const,
      icon: Building2Icon,
      title: values.accountMode === "existing" ? `Existing account: ${values.existingAccount?.name ?? "—"}` : `New account: ${values.account.name}`,
      lines: values.accountMode === "existing" ? ["Nothing about the account changes."] : [ACCOUNT_TYPE_LABELS[values.account.type], values.account.website, values.account.industry],
    },
    {
      step: "contact" as const,
      icon: ContactRoundIcon,
      title: `${values.contact.firstName} ${values.contact.lastName}`,
      lines: [values.contact.title, values.contact.email, values.contact.phone, values.contact.primary ? "Primary contact" : undefined],
    },
    {
      step: "opportunity" as const,
      icon: HandshakeIcon,
      title: values.opportunity.name,
      lines: [
        amount !== undefined && !Number.isNaN(amount) ? formatCurrency(amount, { precise: true }) : undefined,
        `${STAGE_LABELS[values.opportunity.stage]} · closes ${values.opportunity.closeDate ? formatCalendarDate(values.opportunity.closeDate) : "—"}`,
        values.opportunity.nextStep ? `Next step: ${values.opportunity.nextStep}` : undefined,
      ],
    },
  ];
  return (
    <ul className="grid gap-2" aria-label="Review">
      {sections.map(({ step, icon: Icon, title, lines }) => (
        <li key={step} className="flex items-start gap-3 rounded-lg border p-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{title}</p>
            {lines.filter(Boolean).map((line) => (
              <p key={line} className="truncate text-xs text-muted-foreground">
                {line}
              </p>
            ))}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(step)} aria-label={`Edit ${STEP_LABELS[step].toLowerCase()}`}>
            Edit
          </Button>
        </li>
      ))}
    </ul>
  );
}

function ConversionSummary({ result, onDone }: { result: LeadConversionResult; onDone: () => void }) {
  const links = [
    { label: result.accountCreated ? "Account created" : "Account linked", record: result.account, href: `/accounts/${result.account.id}`, icon: Building2Icon },
    { label: "Contact created", record: result.contact, href: `/contacts/${result.contact.id}`, icon: ContactRoundIcon },
    { label: "Opportunity created", record: result.opportunity, href: `/opportunities/${result.opportunity.id}`, icon: HandshakeIcon },
  ];
  return (
    <>
      <DialogHeader>
        <div className="mb-1 grid size-10 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
          <CheckCircle2Icon className="size-5" aria-hidden="true" />
        </div>
        <DialogTitle>Lead converted</DialogTitle>
        <DialogDescription>
          {result.lead.fullName} ({result.lead.number}) is now a customer record. Everything below was saved together.
        </DialogDescription>
      </DialogHeader>
      <ul className="grid gap-2" aria-label="Converted records">
        {links.map(({ label, record, href, icon: Icon }) => (
          <li key={href}>
            <Link href={href} onClick={onDone} className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">{label}</span>
                <span className="block truncate text-sm font-medium group-hover:text-primary">{record.name}</span>
              </span>
              <span className="font-mono text-xs text-muted-foreground">{record.number}</span>
            </Link>
          </li>
        ))}
      </ul>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Done
        </Button>
        <Button render={<Link href={`/opportunities/${result.opportunity.id}`} onClick={onDone} />} nativeButton={false}>
          Open opportunity
        </Button>
      </DialogFooter>
    </>
  );
}
