/**
 * Cookie-to-header CSRF protection (docs/adr/0002-session-authentication.md). The backend sets a readable
 * XSRF-TOKEN cookie; every write request echoes it in the X-XSRF-TOKEN header.
 */
export const CSRF_COOKIE = "XSRF-TOKEN";
export const CSRF_HEADER = "X-XSRF-TOKEN";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function readCookie(name: string, cookieString: string = typeof document === "undefined" ? "" : document.cookie) {
  for (const part of cookieString.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export function isWriteMethod(method: string) {
  return WRITE_METHODS.has(method.toUpperCase());
}

let pendingTokenRequest: Promise<unknown> | null = null;

/** Returns the current token, asking the backend for one first if the cookie is missing (e.g. just after sign-in). */
export async function ensureCsrfToken(): Promise<string | undefined> {
  let token = readCookie(CSRF_COOKIE);
  if (!token) {
    pendingTokenRequest ??= fetch("/api/v1/auth/csrf", { credentials: "same-origin" }).finally(() => {
      pendingTokenRequest = null;
    });
    await pendingTokenRequest;
    token = readCookie(CSRF_COOKIE);
  }
  return token;
}

/** Drops a token the server rejected, so the next write fetches a fresh one. */
export function discardCsrfToken() {
  document.cookie = `${CSRF_COOKIE}=; Max-Age=0; path=/`;
}
