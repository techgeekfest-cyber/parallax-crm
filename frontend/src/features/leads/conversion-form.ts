import { z } from "zod";

import type { AccountType } from "@/features/accounts/api";
import type { OpportunityStage, OpportunityType } from "@/features/opportunities/api";
import { moneyString, optionalEmail, optionalText, requiredText, toNumber, toText } from "@/lib/form-fields";

import type { Lead, LeadConversionRequest } from "./api";

/**
 * The lead-conversion wizard's form model. Values start from the lead and are reviewed (and edited) by the user before
 * anything is sent. Mirrors the backend's validation so most mistakes are caught on the step where they happen.
 */
export const conversionFormSchema = z
  .object({
    accountMode: z.enum(["new", "existing"]),
    account: z.object({
      type: z.enum(["ENTERPRISE", "SMB", "STARTUP"]),
      name: z.string().trim().max(200, "Keep it under 200 characters"),
      website: optionalText(255),
      phone: optionalText(40),
      industry: optionalText(100),
    }),
    existingAccount: z.object({ id: z.string(), name: z.string() }).nullable(),
    contact: z.object({
      firstName: requiredText("First name", 100),
      lastName: requiredText("Last name", 100),
      email: optionalEmail,
      phone: optionalText(40),
      title: optionalText(120),
      primary: z.boolean(),
    }),
    opportunity: z.object({
      name: requiredText("Opportunity name", 200),
      amount: moneyString({ required: true }),
      closeDate: z.string().min(1, "Close date is required"),
      stage: z.enum(["PROSPECTING", "QUALIFICATION", "PROPOSAL", "NEGOTIATION"]),
      type: z.string(),
      nextStep: optionalText(255),
    }),
  })
  .superRefine((values, ctx) => {
    if (values.accountMode === "new" && values.account.name === "") {
      ctx.addIssue({ code: "custom", path: ["account", "name"], message: "Account name is required" });
    }
    if (values.accountMode === "existing" && !values.existingAccount) {
      ctx.addIssue({ code: "custom", path: ["existingAccount"], message: "Choose an account" });
    }
  });

export type ConversionFormValues = z.input<typeof conversionFormSchema>;
export type ConversionFormOutput = z.output<typeof conversionFormSchema>;

export const CONVERSION_STEPS = ["account", "contact", "opportunity", "review"] as const;
export type ConversionStep = (typeof CONVERSION_STEPS)[number];

/** The form fields each step owns, for per-step validation and for sending server errors to the right step. */
export const STEP_FIELDS = {
  account: ["accountMode", "account", "existingAccount"],
  contact: ["contact"],
  opportunity: ["opportunity"],
} as const satisfies Record<Exclude<ConversionStep, "review">, readonly string[]>;

/** Which step shows a (server or client) field path such as `contact.email` or `existingAccountId`. */
export function stepForField(field: string): Exclude<ConversionStep, "review"> | undefined {
  const root = field.split(".")[0];
  if (root === "account" || root === "existingAccountId" || root === "existingAccount" || root === "ownerId") return "account";
  if (root === "contact") return "contact";
  if (root === "opportunity") return "opportunity";
  return undefined;
}

/** Maps an API field (e.g. `existingAccountId`) to the form path that shows it. */
export function formPathForField(field: string): string | undefined {
  if (field === "existingAccountId") return "existingAccount";
  if (field === "account") return "account.name";
  return stepForField(field) ? field : undefined;
}

/** Everything the lead already tells us, as a starting point the user reviews. */
export function conversionDefaults(lead: Lead, today = new Date()): ConversionFormValues {
  const inAMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    accountMode: "new",
    account: { type: "SMB", name: lead.company, website: "", phone: "", industry: "" },
    existingAccount: null,
    contact: {
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone ?? "",
      title: "",
      primary: true,
    },
    opportunity: {
      name: `${lead.company} — new business`,
      amount: lead.estimatedValue !== undefined ? String(lead.estimatedValue) : "",
      closeDate: inAMonth,
      stage: "PROSPECTING",
      type: "NEW_BUSINESS",
      nextStep: "",
    },
  };
}

export function toConversionRequest(values: ConversionFormOutput, leadVersion: number): LeadConversionRequest {
  const existing = values.accountMode === "existing";
  return {
    version: leadVersion,
    existingAccountId: existing ? values.existingAccount?.id : undefined,
    account: existing
      ? undefined
      : {
          type: values.account.type as AccountType,
          name: values.account.name.trim(),
          website: toText(values.account.website),
          phone: toText(values.account.phone),
          industry: toText(values.account.industry),
        },
    contact: {
      firstName: values.contact.firstName.trim(),
      lastName: values.contact.lastName.trim(),
      email: toText(values.contact.email),
      phone: toText(values.contact.phone),
      title: toText(values.contact.title),
      primary: values.contact.primary,
    },
    opportunity: {
      name: values.opportunity.name.trim(),
      amount: toNumber(values.opportunity.amount)!,
      closeDate: values.opportunity.closeDate,
      stage: values.opportunity.stage as OpportunityStage,
      type: (values.opportunity.type || undefined) as OpportunityType | undefined,
      nextStep: toText(values.opportunity.nextStep),
    },
  };
}
