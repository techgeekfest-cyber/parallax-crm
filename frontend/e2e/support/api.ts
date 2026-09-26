import { request, type APIRequestContext } from "@playwright/test";

/** Signs in through the real API (via the Next.js proxy) and returns a context holding the session cookie. */
export async function apiLogin(baseURL: string, email: string, password: string): Promise<APIRequestContext> {
  const context = await request.newContext({ baseURL });
  const response = await write(context, "post", "/api/v1/auth/login", { email, password });
  if (!response.ok()) {
    throw new Error(`Sign-in failed for ${email}: ${response.status()} ${await response.text()}`);
  }
  return context;
}

/** A write request with the cookie-to-header CSRF token, exactly as the app sends it. */
export async function write(context: APIRequestContext, method: "post" | "put", path: string, data: unknown) {
  let token = await csrfToken(context);
  if (!token) {
    await context.get("/api/v1/auth/csrf");
    token = await csrfToken(context);
  }
  return context[method](path, { data, headers: token ? { "X-XSRF-TOKEN": token } : {} });
}

async function csrfToken(context: APIRequestContext) {
  return (await context.storageState()).cookies.find((cookie) => cookie.name === "XSRF-TOKEN")?.value;
}
