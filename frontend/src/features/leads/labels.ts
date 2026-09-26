import type { LeadSource, LeadStatus } from "./api";

// Display vocabulary for backend enums. Values come from the API; only their labels live here.

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  DISQUALIFIED: "Disqualified",
  CONVERTED: "Converted",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  WEB: "Website",
  REFERRAL: "Referral",
  EVENT: "Event",
  PARTNER: "Partner",
  OUTBOUND: "Outbound",
  ADVERTISING: "Advertising",
  OTHER: "Other",
};

export const LEAD_STATUSES = Object.keys(LEAD_STATUS_LABELS) as LeadStatus[];
export const LEAD_SOURCES = Object.keys(LEAD_SOURCE_LABELS) as LeadSource[];
