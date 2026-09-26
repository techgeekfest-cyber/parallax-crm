import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic check only: without a session cookie there is no point rendering an app page, so go to sign-in.
 * A present cookie proves nothing — the backend validates the session on every API call, and a 401 sends the user
 * back to /login from the client.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("PARALLAX_SESSION")) {
    const url = new URL("/login", request.url);
    const next = request.nextUrl.pathname + request.nextUrl.search;
    if (next !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except the sign-in page, API proxy, Next.js internals and static files.
  matcher: ["/((?!login|api/|_next/|icon\\.svg|favicon\\.ico|robots\\.txt).*)"],
};
