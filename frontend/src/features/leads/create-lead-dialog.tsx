"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useId } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { describeError, isApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

import { useCreateLead } from "./api";
import { LEAD_SOURCE_LABELS, LEAD_SOURCES } from "./labels";
import { emptyLeadForm, leadFormSchema, toCreateLeadInput, type LeadFormValues } from "./lead-form-schema";

type LeadFormOutput = z.output<typeof leadFormSchema>;
type FieldName = keyof LeadFormValues;

export function CreateLeadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const createLead = useCreateLead();
  const idPrefix = useId();
  const form = useForm<LeadFormValues, unknown, LeadFormOutput>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: emptyLeadForm,
  });
  const { errors, isSubmitting } = form.formState;

  function close(next: boolean) {
    if (!next && isSubmitting) return;
    if (!next) form.reset(emptyLeadForm);
    onOpenChange(next);
  }

  async function onSubmit(values: LeadFormOutput) {
    try {
      const lead = await createLead.mutateAsync(toCreateLeadInput(values));
      toast.success(`${lead.fullName} added`, {
        description: `Saved as ${lead.number}.`,
        action: { label: "View", onClick: () => router.push(`/leads/${lead.id}`) },
      });
      form.reset(emptyLeadForm);
      onOpenChange(false);
    } catch (error) {
      // Server-side validation and duplicate checks come back as field errors; show them on the field itself.
      const fieldErrors = isApiError(error) ? error.fieldErrors.filter((e) => e.field in emptyLeadForm) : [];
      if (fieldErrors.length > 0) {
        fieldErrors.forEach((e, index) =>
          form.setError(e.field as FieldName, { message: e.message }, { shouldFocus: index === 0 }),
        );
      } else {
        form.setError("root", { message: describeError(error) });
      }
    }
  }

  const fieldId = (name: FieldName) => `${idPrefix}-${name}`;
  const text = (name: Exclude<FieldName, "source" | "notes">, label: string, props: React.ComponentProps<"input"> = {}) => (
    <Field id={fieldId(name)} label={label} error={errors[name]?.message} optional={!["firstName", "lastName", "company", "email"].includes(name)}>
      <Input id={fieldId(name)} aria-invalid={!!errors[name]} {...form.register(name)} {...props} />
    </Field>
  );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
          <DialogDescription>Capture a prospect. You can qualify and convert them later.</DialogDescription>
        </DialogHeader>

        <form id={`${idPrefix}-form`} noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {text("firstName", "First name", { autoComplete: "given-name", autoFocus: true })}
            {text("lastName", "Last name", { autoComplete: "family-name" })}
          </div>
          {text("company", "Company", { autoComplete: "organization" })}
          <div className="grid gap-4 sm:grid-cols-2">
            {text("email", "Email", { type: "email", autoComplete: "email" })}
            {text("phone", "Phone", { type: "tel", autoComplete: "tel" })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={fieldId("source")} label="Source" error={errors.source?.message} optional>
              <Controller
                control={form.control}
                name="source"
                render={({ field }) => (
                  <Select
                    items={LEAD_SOURCE_LABELS}
                    value={field.value || null}
                    onValueChange={(value) => field.onChange(value ?? "")}
                  >
                    <SelectTrigger id={fieldId("source")} className="w-full" onBlur={field.onBlur}>
                      <SelectValue placeholder="Select a source" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_SOURCES.map((source) => (
                        <SelectItem key={source} value={source}>
                          {LEAD_SOURCE_LABELS[source]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            {text("estimatedValue", "Estimated value (USD)", { inputMode: "decimal", placeholder: "25000" })}
          </div>
          <Field id={fieldId("notes")} label="Notes" error={errors.notes?.message} optional>
            <Textarea id={fieldId("notes")} rows={3} aria-invalid={!!errors.notes} {...form.register("notes")} />
          </Field>

          {errors.root && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errors.root.message}
            </p>
          )}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={`${idPrefix}-form`} disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Create lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  error,
  optional,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="flex items-baseline gap-1.5">
        {label}
        {optional && <span className="text-xs font-normal text-muted-foreground">optional</span>}
      </Label>
      {children}
      <p className={cn("text-xs text-destructive", !error && "sr-only")} aria-live="polite">
        {error}
      </p>
    </div>
  );
}
