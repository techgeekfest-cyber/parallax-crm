import { describe, expect, it } from "vitest";

import { request } from "@/lib/api/client";
import { ApiError, describeError, toApiError } from "@/lib/api/errors";

describe("toApiError", () => {
  it("keeps the server's ProblemDetail code, message, field errors and request id", () => {
    const error = toApiError(409, {
      status: 409,
      detail: "A lead with email 'ada@example.com' already exists.",
      code: "DUPLICATE_RECORD",
      requestId: "abc-123",
      fieldErrors: [{ field: "email", message: "A lead with email 'ada@example.com' already exists." }],
    });

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("DUPLICATE_RECORD");
    expect(error.message).toContain("already exists");
    expect(error.fieldErrors).toEqual([{ field: "email", message: expect.any(String) }]);
    expect(error.requestId).toBe("abc-123");
  });

  it("explains gateway errors as a server that is starting up", () => {
    expect(toApiError(503, "<html>Service Unavailable</html>").code).toBe("SERVICE_UNAVAILABLE");
  });

  it("never surfaces raw bodies for unexpected server errors", () => {
    const error = toApiError(500, "java.lang.NullPointerException at com.parallaxcrm…");
    expect(error.message).not.toContain("java.lang");
    expect(error.code).toBe("INTERNAL_ERROR");
  });
});

describe("request", () => {
  it("returns data for successful responses", async () => {
    const data = await request(Promise.resolve({ data: { id: "1" }, response: new Response(null, { status: 200 }) }));
    expect(data).toEqual({ id: "1" });
  });

  it("throws an ApiError built from the error body", async () => {
    const call = Promise.resolve({
      error: { code: "RECORD_NOT_FOUND", detail: "Lead x was not found." },
      response: new Response(null, { status: 404 }),
    });
    await expect(request(call)).rejects.toMatchObject({ status: 404, code: "RECORD_NOT_FOUND" });
  });

  it("turns fetch failures into a friendly network error", async () => {
    await expect(request(Promise.reject(new TypeError("Failed to fetch")))).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
  });
});

describe("describeError", () => {
  it("falls back to a generic message for non-API errors", () => {
    expect(describeError(new Error("secret internals"))).not.toContain("secret");
  });
});
