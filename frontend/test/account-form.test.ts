import { describe, expect, it } from "vitest";

import { accountFormSchema, accountToForm, emptyAccountForm, toAccountRequest } from "@/features/accounts/account-form";
import type { Account } from "@/features/accounts/api";

describe("account form", () => {
  it("requires a name and rejects malformed numbers", () => {
    const result = accountFormSchema.safeParse({ ...emptyAccountForm("SMB"), employeeCount: "12.5", annualRevenue: "abc" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining(["name", "employeeCount", "annualRevenue"]),
    );
  });

  it("sends only the profile that matches the account type", () => {
    const values = accountFormSchema.parse({
      ...emptyAccountForm("ENTERPRISE"),
      name: " Globex ",
      annualRevenue: "2,500,000",
      enterprise: {
        ...emptyAccountForm().enterprise,
        subsidiaries: "Globex Labs\n\n  Globex Europe  ",
        hasEnterpriseSupport: true,
      },
      smb: { ...emptyAccountForm().smb, businessType: "should not be sent" },
    });

    const request = toAccountRequest(values);

    expect(request.name).toBe("Globex");
    expect(request.annualRevenue).toBe(2500000);
    expect(request.enterprise).toMatchObject({ subsidiaries: ["Globex Labs", "Globex Europe"], hasEnterpriseSupport: true });
    expect(request.smb).toBeUndefined();
    expect(request.startup).toBeUndefined();
    expect(request.version).toBeUndefined();
  });

  it("copies the billing address to shipping when asked", () => {
    const values = accountFormSchema.parse({
      ...emptyAccountForm("SMB"),
      name: "Corner Bakery",
      billing: { street: "1 Main St", city: "Springfield", state: "", postalCode: "", country: "US" },
      shipping: { street: "ignored", city: "", state: "", postalCode: "", country: "" },
      shippingSameAsBilling: true,
    });

    const request = toAccountRequest(values, 3);

    expect(request.shippingAddress).toEqual(request.billingAddress);
    expect(request.billingAddress).toEqual({ street: "1 Main St", city: "Springfield", state: undefined, postalCode: undefined, country: "US" });
    expect(request.version).toBe(3);
  });

  it("round-trips an existing account into the form", () => {
    const account = {
      id: "a1",
      number: "ACC-000001",
      type: "STARTUP",
      tier: "GROWTH_STAGE",
      supportLevel: "STANDARD",
      name: "Rocketship",
      employeeCount: 40,
      billingAddress: { city: "Austin" },
      shippingAddress: {},
      startup: { fundingRound: "SERIES_A", totalFunding: 12000000 },
      archived: false,
      createdAt: "",
      updatedAt: "",
      version: 2,
      permissions: { canEdit: true, canArchive: false },
    } as Account;

    const form = accountToForm(account);

    expect(form).toMatchObject({ type: "STARTUP", employeeCount: "40", startup: { fundingRound: "SERIES_A", totalFunding: "12000000" } });
    expect(form.billing.city).toBe("Austin");
  });
});
