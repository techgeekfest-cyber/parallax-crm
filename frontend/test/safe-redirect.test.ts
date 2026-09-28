import { describe, expect, it } from "vitest";

import { loginPath, safeNextPath } from "@/lib/safe-redirect";

describe("safeNextPath", () => {
  it.each(["/leads", "/leads/abc?tab=notes", "/users"])("keeps same-site path %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    ["missing", null],
    ["absolute URL", "https://evil.example/phish"],
    ["protocol-relative URL", "//evil.example"],
    ["backslash trick", "/\\evil.example"],
    ["javascript URL", "javascript:alert(1)"],
    ["the login page itself", "/login?next=/leads"],
  ])("falls back for %s", (_label, next) => {
    expect(safeNextPath(next)).toBe("/dashboard");
  });

  it("builds an encoded login link", () => {
    expect(loginPath("/leads?q=acme corp")).toBe("/login?next=%2Fleads%3Fq%3Dacme%20corp");
  });
});
