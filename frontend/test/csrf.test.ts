import { describe, expect, it } from "vitest";

import { isWriteMethod, readCookie } from "@/lib/api/csrf";

describe("readCookie", () => {
  it("finds a cookie among several", () => {
    expect(readCookie("XSRF-TOKEN", "theme=dark; XSRF-TOKEN=abc-123; other=x")).toBe("abc-123");
  });

  it("does not match cookies whose names merely end with the name", () => {
    expect(readCookie("XSRF-TOKEN", "NOT-XSRF-TOKEN=nope")).toBeUndefined();
  });

  it("keeps '=' characters inside values", () => {
    expect(readCookie("t", "t=a=b")).toBe("a=b");
  });
});

describe("isWriteMethod", () => {
  it.each(["POST", "put", "PATCH", "DELETE"])("%s needs a CSRF token", (method) => {
    expect(isWriteMethod(method)).toBe(true);
  });

  it.each(["GET", "HEAD", "OPTIONS"])("%s does not", (method) => {
    expect(isWriteMethod(method)).toBe(false);
  });
});
