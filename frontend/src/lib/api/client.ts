import createClient from "openapi-fetch";

import { discardCsrfToken, ensureCsrfToken, CSRF_HEADER, isWriteMethod } from "./csrf";
import { ApiError, networkError, toApiError } from "./errors";
import type { paths } from "./schema";

/**
 * Typed client for the ParallaxCRM REST API. Requests are same-origin (`/api/...`) and proxied to the backend by
 * Next.js rewrites, so the session cookie is first-party. Types are generated from the backend's OpenAPI document:
 * `npm run api:types`.
 */
export const api = createClient<paths>({ baseUrl: "", credentials: "same-origin" });

api.use({
  async onRequest({ request }) {
    if (isWriteMethod(request.method)) {
      const token = await ensureCsrfToken();
      if (token) request.headers.set(CSRF_HEADER, token);
    }
    return request;
  },
});

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
    const error = toApiError(result.response.status, result.error);
    if (error.code === "CSRF_REJECTED") discardCsrfToken();
    throw error;
  }
  return result.data as T;
}

/** For the few endpoints outside the OpenAPI document (sign-out is handled by the security filter chain). */
export async function postWithoutBody(path: string): Promise<void> {
  const token = await ensureCsrfToken();
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: token ? { [CSRF_HEADER]: token } : {},
    });
  } catch {
    throw networkError();
  }
  if (!response.ok) {
    throw toApiError(response.status, await response.json().catch(() => undefined));
  }
}
