import createClient from "openapi-fetch";

import { ApiError, networkError, toApiError } from "./errors";
import type { paths } from "./schema";

/**
 * Typed client for the ParallaxCRM REST API. Requests are same-origin (`/api/...`) and proxied to the backend by
 * Next.js rewrites. Types are generated from the backend's OpenAPI document: `npm run api:types`.
 */
export const api = createClient<paths>({ baseUrl: "" });

type ApiResult<T> = { data?: T; error?: unknown; response: Response };

/** Resolves to the response body, or throws an {@link ApiError} carrying the server's ProblemDetail. */
export async function request<T>(call: Promise<ApiResult<T>>): Promise<T> {
  let result: ApiResult<T>;
  try {
    result = await call;
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    throw networkError();
  }
  if (!result.response.ok || result.error !== undefined) {
    throw toApiError(result.response.status, result.error);
  }
  return result.data as T;
}
