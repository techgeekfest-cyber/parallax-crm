import { z } from "zod";

import { optionalText, requiredText, toText } from "@/lib/form-fields";

import type { ActivityRequest } from "./api";
import { MANUAL_ACTIVITY_TYPES } from "./labels";

export const activityFormSchema = z.object({
  type: z.enum(MANUAL_ACTIVITY_TYPES),
  subject: requiredText("Subject", 255),
  body: optionalText(5000),
  /** `datetime-local` value; empty means "now". */
  occurredAt: z
    .string()
    .refine((value) => value === "" || !Number.isNaN(new Date(value).getTime()), "Enter a valid date and time")
    .refine((value) => value === "" || new Date(value).getTime() <= Date.now() + 5 * 60_000, "Can't be in the future"),
});

export type ActivityFormValues = z.infer<typeof activityFormSchema>;

export const emptyActivityForm: ActivityFormValues = { type: "CALL", subject: "", body: "", occurredAt: "" };

export function toActivityRequest(values: ActivityFormValues): Omit<ActivityRequest, "leadId" | "accountId" | "contactId" | "opportunityId"> {
  return {
    type: values.type,
    subject: values.subject.trim(),
    body: toText(values.body),
    // datetime-local is the user's local time; the API stores an instant.
    occurredAt: values.occurredAt ? new Date(values.occurredAt).toISOString() : undefined,
  };
}
