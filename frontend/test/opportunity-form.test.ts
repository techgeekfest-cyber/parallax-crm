import { describe, expect, it } from "vitest";

import { emptyOpportunityForm, opportunityFormSchema, toOpportunityRequest } from "@/features/opportunities/opportunity-form";

const account = { id: "acc-1", name: "Contoso" };

describe("opportunity form", () => {
  it("requires an account, a name, an amount and a close date", () => {
    const result = opportunityFormSchema.safeParse({ ...emptyOpportunityForm(), closeDate: "" });
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(
      expect.arrayContaining(["account", "name", "amount", "closeDate"]),
    );
  });

  it("rejects probabilities outside 0–100", () => {
    const result = opportunityFormSchema.safeParse({ ...emptyOpportunityForm(account), name: "Deal", amount: "10", probability: "120" });
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(["probability"]);
  });

  it("leaves probability to the server for closed stages and blank inputs", () => {
    const closed = toOpportunityRequest(
      opportunityFormSchema.parse({ ...emptyOpportunityForm(account), name: "Won deal", amount: "5000", stage: "CLOSED_WON", probability: "40" }),
    );
    const blank = toOpportunityRequest(
      opportunityFormSchema.parse({ ...emptyOpportunityForm(account), name: "New deal", amount: "5000", probability: "" }),
    );

    expect(closed.probability).toBeUndefined();
    expect(blank.probability).toBeUndefined();
    expect(blank.accountId).toBe("acc-1");
  });

  it("converts amounts and omits empty optional fields", () => {
    const request = toOpportunityRequest(
      opportunityFormSchema.parse({ ...emptyOpportunityForm(account), name: " Rollout ", amount: "25,000.50", probability: "60", nextStep: "  " }),
      7,
    );
    expect(request).toMatchObject({ name: "Rollout", amount: 25000.5, probability: 60, version: 7 });
    expect(request.nextStep).toBeUndefined();
    expect(request.type).toBeUndefined();
  });
});
