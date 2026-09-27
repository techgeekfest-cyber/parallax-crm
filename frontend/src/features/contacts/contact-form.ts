import { z } from "zod";

import { addressSchema, emptyAddress, optionalEmail, optionalText, requiredText, toAddressBody, toAddressValues, toText } from "@/lib/form-fields";

import type { Contact, ContactRequest } from "./api";

export const contactFormSchema = z.object({
  account: z.object({ id: z.string(), name: z.string() }).nullable().refine((value) => value !== null, "Choose an account"),
  firstName: requiredText("First name", 100),
  lastName: requiredText("Last name", 100),
  email: optionalEmail,
  phone: optionalText(40),
  title: optionalText(120),
  department: optionalText(120),
  primary: z.boolean(),
  mailing: addressSchema,
  ownerId: z.string(),
});

/** What the form holds while editing (the account may still be empty). */
export type ContactFormValues = z.input<typeof contactFormSchema>;
/** What a successful validation produces (the account is guaranteed). */
export type ContactFormOutput = z.output<typeof contactFormSchema>;

export function emptyContactForm(account: { id: string; name: string } | null = null): ContactFormValues {
  return {
    account,
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    title: "",
    department: "",
    primary: false,
    mailing: emptyAddress,
    ownerId: "",
  };
}

export function contactToForm(contact: Contact): ContactFormValues {
  return {
    account: { id: contact.account.id, name: contact.account.name },
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    title: contact.title ?? "",
    department: contact.department ?? "",
    primary: contact.primary,
    mailing: toAddressValues(contact.mailingAddress),
    ownerId: contact.owner?.id ?? "",
  };
}

export function toContactRequest(values: ContactFormOutput, version?: number): ContactRequest {
  return {
    accountId: values.account.id,
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: toText(values.email),
    phone: toText(values.phone),
    title: toText(values.title),
    department: toText(values.department),
    primary: values.primary,
    mailingAddress: toAddressBody(values.mailing),
    ownerId: values.ownerId || undefined,
    version,
  };
}
