import { describe, expect, it } from "vitest";

import { contactFormSchema, emptyContactForm, toContactRequest } from "@/features/contacts/contact-form";

describe("contact form", () => {
  it("needs an account and a name, and validates optional email", () => {
    const result = contactFormSchema.safeParse({ ...emptyContactForm(), email: "nope" });
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(
      expect.arrayContaining(["account", "firstName", "lastName", "email"]),
    );
  });

  it("builds the request with primary status and a blank-safe address", () => {
    const request = toContactRequest(
      contactFormSchema.parse({
        ...emptyContactForm({ id: "acc-1", name: "Northwind" }),
        firstName: "Maria",
        lastName: "Anders",
        email: "",
        primary: true,
      }),
    );
    expect(request).toMatchObject({ accountId: "acc-1", firstName: "Maria", primary: true });
    expect(request.email).toBeUndefined();
    expect(request.mailingAddress).toEqual({ street: undefined, city: undefined, state: undefined, postalCode: undefined, country: undefined });
  });
});
