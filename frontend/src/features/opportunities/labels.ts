import type { OpportunityStage, OpportunityType } from "./api";

export const STAGE_LABELS: Record<OpportunityStage, string> = {
  PROSPECTING: "Prospecting",
  QUALIFICATION: "Qualification",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  CLOSED_WON: "Closed won",
  CLOSED_LOST: "Closed lost",
};

export const STAGES = Object.keys(STAGE_LABELS) as OpportunityStage[];
export const OPEN_STAGES: OpportunityStage[] = ["PROSPECTING", "QUALIFICATION", "PROPOSAL", "NEGOTIATION"];

/** Mirrors the backend's defaults, so the form can preview the probability a stage will get. */
export const STAGE_DEFAULT_PROBABILITY: Record<OpportunityStage, number> = {
  PROSPECTING: 10,
  QUALIFICATION: 25,
  PROPOSAL: 50,
  NEGOTIATION: 75,
  CLOSED_WON: 100,
  CLOSED_LOST: 0,
};

export function isClosed(stage: OpportunityStage) {
  return stage === "CLOSED_WON" || stage === "CLOSED_LOST";
}

export const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  NEW_BUSINESS: "New business",
  EXISTING_BUSINESS: "Existing business",
  RENEWAL: "Renewal",
  UPSELL: "Upsell",
};
