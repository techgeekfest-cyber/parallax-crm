import { describe, expect, it } from "vitest";

import type { Lead } from "@/features/leads/api";
import {
  conversionDefaults,
  conversionFormSchema,
  formPathForField,
  stepForField,
  toConversionRequest,
  type ConversionFormValues,
} from "@/features/leads/conversion-form";

// A lead as the API returns it (test fixture only).
const lead: Lead = {
  id: "lead-1",
  number: "LD-000007",
  firstName: "Ada",
  lastName: "Lovelace",
  fullName: "Ada Lovelace",
  company: "Analytical Engines",
  email: "ada@engines.test",
  phone: "+44 20 7946 0000",
  status: "QUALIFIED",
  estimatedValue: 42000,
  createdAt: "2026-09-01T10:00:00Z",
  updatedAt: "2026-09-02T10:00:00Z",
  version: 3,
};

const valid = () => conversionDefaults(lead, new Date("2026-09-28T00:00:00Z"));
const issues = (values: ConversionFormValues) =>
  conversionFormSchema.safeParse(values).error?.issues.map((issue) => issue.path.join(".")) ?? [];

describe("lead conversion form", () => {
  it("starts from what the lead already says", () => {
    const values = valid();
    expect(values.account).toMatchObject({ name: "Analytical Engines", type: "SMB" });
    expect(values.contact).toMatchObject({ firstName: "Ada", lastName: "Lovelace", email: "ada@engines.test", primary: true });
    expect(values.opportunity).toMatchObject({ amount: "42000", stage: "PROSPECTING", closeDate: "2026-10-28" });
    expect(issues(values)).toEqual([]);
  });

  it("requires a new account's name, or an existing account", () => {
    expect(issues({ ...valid(), account: { ...valid().account, name: "  " } })).toEqual(["account.name"]);
    expect(issues({ ...valid(), accountMode: "existing" })).toEqual(["existingAccount"]);
    expect(issues({ ...valid(), accountMode: "existing", existingAccount: { id: "acc-9", name: "Contoso" } })).toEqual([]);
  });

  it("validates the contact and opportunity like the API does", () => {
    const values = valid();
    values.contact = { ...values.contact, lastName: "", email: "not-an-email" };
    values.opportunity = { ...values.opportunity, name: "", amount: "12.345", closeDate: "" };
    expect(issues(values)).toEqual(
      expect.arrayContaining(["contact.lastName", "contact.email", "opportunity.name", "opportunity.amount", "opportunity.closeDate"]),
    );
  });

  it("sends a new account, or only the existing account's id", () => {
    const created = toConversionRequest(conversionFormSchema.parse(valid()), lead.version);
    expect(created).toMatchObject({
      version: 3,
      account: { type: "SMB", name: "Analytical Engines" },
      contact: { firstName: "Ada", email: "ada@engines.test", primary: true },
      opportunity: { amount: 42000, stage: "PROSPECTING", type: "NEW_BUSINESS" },
    });
    expect(created.existingAccountId).toBeUndefined();
    expect(created.account?.website).toBeUndefined();

    const linked = toConversionRequest(
      conversionFormSchema.parse({ ...valid(), accountMode: "existing", existingAccount: { id: "acc-9", name: "Contoso" } }),
      lead.version,
    );
    expect(linked.existingAccountId).toBe("acc-9");
    expect(linked.account).toBeUndefined();
  });

  it("routes server field errors to the step that shows them", () => {
    expect(stepForField("contact.email")).toBe("contact");
    expect(stepForField("opportunity.stage")).toBe("opportunity");
    expect(stepForField("existingAccountId")).toBe("account");
    expect(formPathForField("existingAccountId")).toBe("existingAccount");
    expect(formPathForField("account")).toBe("account.name");
    expect(formPathForField("version")).toBeUndefined();
  });
});
