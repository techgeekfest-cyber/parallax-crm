import type { AccountTier, AccountType, FundingRound, GrowthStage, SupportLevel } from "./api";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ENTERPRISE: "Enterprise",
  SMB: "SMB",
  STARTUP: "Startup",
};

export const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[];

export const ACCOUNT_TIER_LABELS: Record<AccountTier, string> = {
  STRATEGIC: "Strategic",
  MAJOR: "Major",
  ESTABLISHED: "Established",
  EMERGING: "Emerging",
  EARLY_STAGE: "Early stage",
  GROWTH_STAGE: "Growth stage",
  LATE_STAGE: "Late stage",
};

export const SUPPORT_LEVEL_LABELS: Record<SupportLevel, string> = {
  DEDICATED: "Dedicated support",
  PRIORITY: "Priority support",
  STANDARD: "Standard support",
};

export const FUNDING_ROUND_LABELS: Record<FundingRound, string> = {
  BOOTSTRAPPED: "Bootstrapped",
  PRE_SEED: "Pre-seed",
  SEED: "Seed",
  SERIES_A: "Series A",
  SERIES_B: "Series B",
  SERIES_C: "Series C",
  SERIES_D_PLUS: "Series D+",
};

export const GROWTH_STAGE_LABELS: Record<GrowthStage, string> = {
  IDEA: "Idea",
  MVP: "MVP",
  EARLY_TRACTION: "Early traction",
  GROWTH: "Growth",
  SCALE: "Scale",
};
