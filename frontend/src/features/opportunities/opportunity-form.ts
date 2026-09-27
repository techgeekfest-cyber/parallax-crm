import { z } from "zod";

import { moneyString, optionalText, requiredText, toNumber, toText } from "@/lib/form-fields";
import type { LeadSource } from "@/features/leads/api";

import type { Opportunity, OpportunityRequest, OpportunityStage, OpportunityType } from "./api";
import { isClosed } from "./labels";

export const opportunityFormSchema = z.object({
  name: requiredText("Opportunity name", 200),
  account: z.object({ id: z.string(), name: z.string() }).nullable().refine((value) => value !== null, "Choose an account"),
  amount: moneyString({ required: true }),
  stage: z.enum(["PROSPECTING", "QUALIFICATION", "PROPOSAL", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST"]),
  probability: z
    .string()
    .trim()
    .refine((value) => value === "" || (/^\d{1,3}$/.test(value) && Number(value) <= 100), "Enter 0–100"),
  closeDate: z.string().min(1, "Close date is required"),
  type: z.string(),
  leadSource: z.string(),
  nextStep: optionalText(255),
  description: optionalText(5000),
  ownerId: z.string(),
});

/** What the form holds while editing (the account may still be empty). */
export type OpportunityFormValues = z.input<typeof opportunityFormSchema>;
/** What a successful validation produces (the account is guaranteed). */
export type OpportunityFormOutput = z.output<typeof opportunityFormSchema>;

export function emptyOpportunityForm(account: { id: string; name: string } | null = null): OpportunityFormValues {
  const inAMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    name: "",
    account,
    amount: "",
    stage: "PROSPECTING",
    probability: "",
    closeDate: inAMonth,
    type: "",
    leadSource: "",
    nextStep: "",
    description: "",
    ownerId: "",
  };
}

export function opportunityToForm(opportunity: Opportunity): OpportunityFormValues {
  return {
    name: opportunity.name,
    account: { id: opportunity.account.id, name: opportunity.account.name },
    amount: String(opportunity.amount),
    stage: opportunity.stage,
    probability: String(opportunity.probability),
    closeDate: opportunity.closeDate,
    type: opportunity.type ?? "",
    leadSource: opportunity.leadSource ?? "",
    nextStep: opportunity.nextStep ?? "",
    description: opportunity.description ?? "",
    ownerId: opportunity.owner?.id ?? "",
  };
}

/**
 * Without a version this is a create, which sets the starting stage. With a version it is an edit, which never sends
 * a stage: stages change only through the stage-transition workflow.
 */
export function toOpportunityRequest(values: OpportunityFormOutput, version?: number): OpportunityRequest {
  const stage = values.stage as OpportunityStage;
  return {
    accountId: values.account.id,
    name: values.name.trim(),
    amount: toNumber(values.amount)!,
    stage: version === undefined ? stage : undefined,
    // Closed stages always get 100/0 on the server; an empty field means "use the stage default".
    probability: isClosed(stage) ? undefined : toNumber(values.probability),
    closeDate: values.closeDate,
    type: (values.type || undefined) as OpportunityType | undefined,
    leadSource: (values.leadSource || undefined) as LeadSource | undefined,
    nextStep: toText(values.nextStep),
    description: toText(values.description),
    ownerId: values.ownerId || undefined,
    version,
  };
}
