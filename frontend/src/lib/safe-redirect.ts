/**
 * Only same-site paths are allowed as post-login destinations, so a crafted `?next=` link can't send a user who just
 * signed in to another site (open-redirect protection).
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (next === "/login" || next.startsWith("/login?")) return fallback;
  return next;
}

export function loginPath(currentPath: string): string {
  return `/login?next=${encodeURIComponent(safeNextPath(currentPath))}`;
}
