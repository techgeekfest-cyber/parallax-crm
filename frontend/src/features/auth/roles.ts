import type { Role } from "./api";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  SALES_MANAGER: "Sales manager",
  SALES_REP: "Sales rep",
};

export const ROLES = Object.keys(ROLE_LABELS) as Role[];

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
