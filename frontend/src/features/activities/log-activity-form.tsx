"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import { Controller, useForm, type Path } from "react-hook-form";
import { toast } from "sonner";

import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { describeError, isApiError } from "@/lib/api/errors";

import { activityFormSchema, emptyActivityForm, toActivityRequest, type ActivityFormValues } from "./activity-form";
import { useLogActivity, type TimelineTarget } from "./api";
import { ACTIVITY_TYPE_LABELS, MANUAL_ACTIVITY_TYPES } from "./labels";

const TYPE_ITEMS = Object.fromEntries(MANUAL_ACTIVITY_TYPES.map((type) => [type, ACTIVITY_TYPE_LABELS[type]]));

export function LogActivityForm({ target, onDone }: { target: TimelineTarget; onDone: () => void }) {
  const id = useId();
  const log = useLogActivity(target);
  const form = useForm<ActivityFormValues>({ resolver: zodResolver(activityFormSchema), defaultValues: emptyActivityForm });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: ActivityFormValues) {
    try {
      await log.mutateAsync(toActivityRequest(values));
      toast.success(`${ACTIVITY_TYPE_LABELS[values.type]} logged`);
      form.reset(emptyActivityForm);
      onDone();
    } catch (error) {
      const known = ["type", "subject", "body", "occurredAt"];
      const fieldErrors = isApiError(error) ? error.fieldErrors.filter((e) => known.includes(e.field)) : [];
      if (fieldErrors.length > 0) {
        fieldErrors.forEach((e) => form.setError(e.field as Path<ActivityFormValues>, { message: e.message }));
      } else {
        form.setError("root", { message: describeError(error) });
      }
    }
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 rounded-lg border bg-muted/30 p-3" aria-label="Log activity">
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <FormField id={`${id}-type`} label="Type">
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <Select items={TYPE_ITEMS} value={field.value} onValueChange={(value) => value && field.onChange(value)}>
                <SelectTrigger id={`${id}-type`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_ACTIVITY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {ACTIVITY_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField id={`${id}-subject`} label="Subject" error={errors.subject?.message}>
          <Input id={`${id}-subject`} autoFocus placeholder="e.g. Discovery call with the CTO" aria-invalid={!!errors.subject} {...form.register("subject")} />
        </FormField>
      </div>
      <FormField id={`${id}-body`} label="Details" optional error={errors.body?.message}>
        <Textarea id={`${id}-body`} rows={3} {...form.register("body")} />
      </FormField>
      <FormField id={`${id}-when`} label="When" optional hint="Leave empty for now." error={errors.occurredAt?.message}>
        <Input id={`${id}-when`} type="datetime-local" className="sm:w-60" aria-invalid={!!errors.occurredAt} {...form.register("occurredAt")} />
      </FormField>
      <FormError message={errors.root?.message} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Log activity"}
        </Button>
      </div>
    </form>
  );
}
