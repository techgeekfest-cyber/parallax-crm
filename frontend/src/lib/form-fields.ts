import { z } from "zod";

/**
 * Zod building blocks mirroring the backend's Bean Validation, so most mistakes are caught before a round trip.
 * Numeric inputs are kept as strings in the form and converted when building the request.
 */
const MONEY = /^\d{1,13}(\.\d{1,2})?$/;
const INTEGER = /^\d{1,9}$/;

export const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `Keep it under ${max} characters`);

export const optionalText = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters`);

export const optionalEmail = z
  .string()
  .trim()
  .max(320, "Email is too long")
  .refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email address");

export const moneyString = ({ required = false, label = "Amount" } = {}) =>
  z
    .string()
    .trim()
    .refine((value) => (required ? value !== "" : true), `${label} is required`)
    .refine((value) => value === "" || MONEY.test(value.replaceAll(",", "")), "Enter an amount such as 25000 or 25000.50");

export const integerString = z
  .string()
  .trim()
  .refine((value) => value === "" || INTEGER.test(value.replaceAll(",", "")), "Enter a whole number");

export function toNumber(value: string): number | undefined {
  const cleaned = value.replaceAll(",", "").trim();
  return cleaned === "" ? undefined : Number(cleaned);
}

export function toText(value: string): string | undefined {
  return value.trim() === "" ? undefined : value.trim();
}

export function fromNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

export const addressSchema = z.object({
  street: optionalText(255),
  city: optionalText(120),
  state: optionalText(120),
  postalCode: optionalText(20),
  country: optionalText(120),
});

export type AddressValues = z.infer<typeof addressSchema>;
export const emptyAddress: AddressValues = { street: "", city: "", state: "", postalCode: "", country: "" };

type AddressLike = { street?: string; city?: string; state?: string; postalCode?: string; country?: string } | undefined;

export function toAddressValues(address: AddressLike): AddressValues {
  return {
    street: address?.street ?? "",
    city: address?.city ?? "",
    state: address?.state ?? "",
    postalCode: address?.postalCode ?? "",
    country: address?.country ?? "",
  };
}

export function toAddressBody(values: AddressValues) {
  return {
    street: toText(values.street),
    city: toText(values.city),
    state: toText(values.state),
    postalCode: toText(values.postalCode),
    country: toText(values.country),
  };
}
