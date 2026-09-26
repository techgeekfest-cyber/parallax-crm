export type FieldError = { field: string; message: string };

/** An error response from the API, normalised from RFC 7807 ProblemDetail. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors: FieldError[] = [],
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ProblemDetail = {
  detail?: string;
  code?: string;
  requestId?: string;
  fieldErrors?: FieldError[];
};

function isProblemDetail(body: unknown): body is ProblemDetail {
  return typeof body === "object" && body !== null && ("code" in body || "detail" in body);
}

export function toApiError(status: number, body: unknown): ApiError {
  if (isProblemDetail(body)) {
    return new ApiError(
      status,
      body.code ?? (status >= 500 ? "INTERNAL_ERROR" : "BAD_REQUEST"),
      body.detail ?? "The request could not be completed.",
      Array.isArray(body.fieldErrors) ? body.fieldErrors : [],
      body.requestId,
    );
  }
  if (status === 502 || status === 503 || status === 504) {
    // Typically the backend is waking up (free-tier cold start) or redeploying.
    return new ApiError(status, "SERVICE_UNAVAILABLE", "The ParallaxCRM server is starting up. Try again in a few seconds.");
  }
  if (status >= 500) {
    return new ApiError(status, "INTERNAL_ERROR", "Something went wrong on our side. Please try again.");
  }
  return new ApiError(status, "BAD_REQUEST", "The request could not be completed.");
}

export function networkError(): ApiError {
  return new ApiError(0, "NETWORK_ERROR", "Can't reach the ParallaxCRM server. Check your connection and try again.");
}

/** A human-readable message for any error thrown while talking to the API. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something unexpected happened. Please try again.";
}

export function isApiError(error: unknown, code?: string): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}
