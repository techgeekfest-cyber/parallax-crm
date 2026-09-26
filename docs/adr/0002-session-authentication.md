# ADR 0002 — Server-side sessions instead of JWT in browser storage

**Status:** Accepted — implemented in A1

## Context

The app needs login, logout, role-based authorization, and the ability to revoke access. The frontend (Vercel) and
backend (Render) are on different hosts.

## Decision

- A JSON sign-in endpoint with BCrypt password hashes. Sign-in always discards any existing session and starts a new
  one (session fixation protection), and the session stores only the user's id, re-read from the database per request.
- Sessions stored in PostgreSQL via **Spring Session JDBC**, so they survive restarts and redeploys.
- Session cookie: `HttpOnly; Secure; SameSite=Lax`. CSRF protection via cookie-to-header token.
- The Next.js app rewrites `/api/*` to the backend, so the browser sees a single origin. The session cookie is
  first-party and no CORS configuration is needed.

## Consequences

- Tokens are never readable by JavaScript, removing the XSS token-theft class of bugs that `localStorage` JWTs have.
- Logout and account deactivation take effect immediately (delete the session row).
- One extra table and a DB lookup per request — negligible at this scale.
- Rejected: JWT in `localStorage` (XSS exposure, hard revocation); cross-site cookies (third-party cookie restrictions).
