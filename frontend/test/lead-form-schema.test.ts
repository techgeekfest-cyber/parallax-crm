import { describe, expect, it } from "vitest";

import { emptyLeadForm, leadFormSchema, toCreateLeadInput } from "@/features/leads/lead-form-schema";

const valid = {
  ...emptyLeadForm,
  firstName: " Ada ",
  lastName: "Lovelace",
  company: "Analytical Engines",
  email: " ada@example.com ",
};

describe("leadFormSchema", () => {
  it("accepts the required fields and trims input", () => {
    const parsed = leadFormSchema.parse(valid);
    expect(parsed.firstName).toBe("Ada");
    expect(parsed.email).toBe("ada@example.com");
  });

  it("reports each missing required field", () => {
    const result = leadFormSchema.safeParse(emptyLeadForm);
    expect(result.success).toBe(false);
    const fields = result.error?.issues.map((issue) => issue.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["firstName", "lastName", "company", "email"]));
  });

  it("rejects malformed emails and amounts", () => {
    const result = leadFormSchema.safeParse({ ...valid, email: "not-an-email", estimatedValue: "12.345" });
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(
      expect.arrayContaining(["email", "estimatedValue"]),
    );
  });
});

describe("toCreateLeadInput", () => {
  it("omits empty optional fields and converts the amount to a number", () => {
    const input = toCreateLeadInput(leadFormSchema.parse({ ...valid, estimatedValue: "25,000.50", source: "EVENT" }));
    expect(input).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
      company: "Analytical Engines",
      email: "ada@example.com",
      phone: undefined,
      source: "EVENT",
      estimatedValue: 25000.5,
      notes: undefined,
    });
  });
});
