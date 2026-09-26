import { z } from "zod";

import type { CreateLeadInput, LeadSource } from "./api";
import { LEAD_SOURCES } from "./labels";

const AMOUNT = /^\d{1,13}(\.\d{1,2})?$/;

/** Mirrors the backend's CreateLeadRequest constraints so most mistakes are caught before a round trip. */
export const leadFormSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100, "Keep it under 100 characters"),
  lastName: z.string().trim().min(1, "Last name is required").max(100, "Keep it under 100 characters"),
  company: z.string().trim().min(1, "Company is required").max(200, "Keep it under 200 characters"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(320, "Email is too long")
    .pipe(z.email("Enter a valid email address")),
  phone: z.string().trim().max(40, "Keep it under 40 characters"),
  source: z.union([z.literal(""), z.enum(LEAD_SOURCES as [LeadSource, ...LeadSource[]])]),
  estimatedValue: z
    .string()
    .trim()
    .refine((value) => value === "" || AMOUNT.test(value.replaceAll(",", "")), "Enter an amount such as 25000 or 25000.50"),
  notes: z.string().trim().max(5000, "Keep notes under 5,000 characters"),
  /** "" means the signed-in user. */
  ownerId: z.string(),
});

export type LeadFormValues = z.input<typeof leadFormSchema>;

export const emptyLeadForm: LeadFormValues = {
  firstName: "",
  lastName: "",
  company: "",
  email: "",
  phone: "",
  source: "",
  estimatedValue: "",
  notes: "",
  ownerId: "",
};

export function toCreateLeadInput(values: z.output<typeof leadFormSchema>): CreateLeadInput {
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    company: values.company,
    email: values.email,
    phone: values.phone || undefined,
    source: values.source || undefined,
    estimatedValue: values.estimatedValue ? Number(values.estimatedValue.replaceAll(",", "")) : undefined,
    notes: values.notes || undefined,
    ownerId: values.ownerId || undefined,
  };
}
