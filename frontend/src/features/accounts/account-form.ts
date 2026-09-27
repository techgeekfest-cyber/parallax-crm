import { z } from "zod";

import {
  addressSchema,
  emptyAddress,
  fromNumber,
  integerString,
  moneyString,
  optionalText,
  requiredText,
  toAddressBody,
  toAddressValues,
  toNumber,
  toText,
} from "@/lib/form-fields";

import type { Account, AccountRequest, AccountType, FundingRound, GrowthStage } from "./api";

/** Form state: one schema for every type; only the active type's section is sent. */
export const accountFormSchema = z.object({
  type: z.enum(["ENTERPRISE", "SMB", "STARTUP"]),
  name: requiredText("Account name", 200),
  industry: optionalText(100),
  website: optionalText(255),
  phone: optionalText(40),
  employeeCount: integerString,
  annualRevenue: moneyString({ label: "Annual revenue" }),
  ownerId: z.string(),
  billing: addressSchema,
  shipping: addressSchema,
  shippingSameAsBilling: z.boolean(),
  enterprise: z.object({
    enterpriseId: optionalText(50),
    globalEmployeeCount: integerString,
    subsidiaries: z
      .string()
      .refine((value) => value.split("\n").filter((line) => line.trim()).length <= 50, "At most 50 subsidiaries")
      .refine((value) => value.split("\n").every((line) => line.trim().length <= 200), "Keep each name under 200 characters"),
    accountManagerId: z.string(),
    hasEnterpriseSupport: z.boolean(),
  }),
  smb: z.object({
    businessType: optionalText(100),
    yearsInBusiness: integerString,
    ownerName: optionalText(200),
    localBusiness: z.boolean(),
  }),
  startup: z.object({
    fundingRound: z.string(),
    totalFunding: moneyString({ label: "Total funding" }),
    investorType: optionalText(50),
    monthsToProfitability: integerString,
    growthStage: z.string(),
  }),
});

export type AccountFormValues = z.infer<typeof accountFormSchema>;

export function emptyAccountForm(type: AccountType = "SMB"): AccountFormValues {
  return {
    type,
    name: "",
    industry: "",
    website: "",
    phone: "",
    employeeCount: "",
    annualRevenue: "",
    ownerId: "",
    billing: emptyAddress,
    shipping: emptyAddress,
    shippingSameAsBilling: false,
    enterprise: { enterpriseId: "", globalEmployeeCount: "", subsidiaries: "", accountManagerId: "", hasEnterpriseSupport: false },
    smb: { businessType: "", yearsInBusiness: "", ownerName: "", localBusiness: false },
    startup: { fundingRound: "", totalFunding: "", investorType: "", monthsToProfitability: "", growthStage: "" },
  };
}

export function accountToForm(account: Account): AccountFormValues {
  const base = emptyAccountForm(account.type);
  const billing = toAddressValues(account.billingAddress);
  const shipping = toAddressValues(account.shippingAddress);
  return {
    ...base,
    name: account.name,
    industry: account.industry ?? "",
    website: account.website ?? "",
    phone: account.phone ?? "",
    employeeCount: fromNumber(account.employeeCount),
    annualRevenue: fromNumber(account.annualRevenue),
    ownerId: account.owner?.id ?? "",
    billing,
    shipping,
    shippingSameAsBilling: false,
    enterprise: account.enterprise
      ? {
          enterpriseId: account.enterprise.enterpriseId ?? "",
          globalEmployeeCount: fromNumber(account.enterprise.globalEmployeeCount),
          subsidiaries: (account.enterprise.subsidiaries ?? []).join("\n"),
          accountManagerId: account.enterprise.accountManagerId ?? "",
          hasEnterpriseSupport: account.enterprise.hasEnterpriseSupport ?? false,
        }
      : base.enterprise,
    smb: account.smb
      ? {
          businessType: account.smb.businessType ?? "",
          yearsInBusiness: fromNumber(account.smb.yearsInBusiness),
          ownerName: account.smb.ownerName ?? "",
          localBusiness: account.smb.localBusiness ?? false,
        }
      : base.smb,
    startup: account.startup
      ? {
          fundingRound: account.startup.fundingRound ?? "",
          totalFunding: fromNumber(account.startup.totalFunding),
          investorType: account.startup.investorType ?? "",
          monthsToProfitability: fromNumber(account.startup.monthsToProfitability),
          growthStage: account.startup.growthStage ?? "",
        }
      : base.startup,
  };
}

/** Builds the request: only the profile matching the type, and empty strings become "not set". */
export function toAccountRequest(values: AccountFormValues, version?: number): AccountRequest {
  const billing = toAddressBody(values.billing);
  return {
    type: values.type,
    name: values.name.trim(),
    industry: toText(values.industry),
    website: toText(values.website),
    phone: toText(values.phone),
    employeeCount: toNumber(values.employeeCount),
    annualRevenue: toNumber(values.annualRevenue),
    ownerId: values.ownerId || undefined,
    billingAddress: billing,
    shippingAddress: values.shippingSameAsBilling ? billing : toAddressBody(values.shipping),
    enterprise:
      values.type === "ENTERPRISE"
        ? {
            enterpriseId: toText(values.enterprise.enterpriseId),
            globalEmployeeCount: toNumber(values.enterprise.globalEmployeeCount),
            subsidiaries: values.enterprise.subsidiaries
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean),
            accountManagerId: values.enterprise.accountManagerId || undefined,
            hasEnterpriseSupport: values.enterprise.hasEnterpriseSupport,
          }
        : undefined,
    smb:
      values.type === "SMB"
        ? {
            businessType: toText(values.smb.businessType),
            yearsInBusiness: toNumber(values.smb.yearsInBusiness),
            ownerName: toText(values.smb.ownerName),
            localBusiness: values.smb.localBusiness,
          }
        : undefined,
    startup:
      values.type === "STARTUP"
        ? {
            fundingRound: (values.startup.fundingRound || undefined) as FundingRound | undefined,
            totalFunding: toNumber(values.startup.totalFunding),
            investorType: toText(values.startup.investorType),
            monthsToProfitability: toNumber(values.startup.monthsToProfitability),
            growthStage: (values.startup.growthStage || undefined) as GrowthStage | undefined,
          }
        : undefined,
    version,
  };
}
