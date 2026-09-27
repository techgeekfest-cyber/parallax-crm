# ParallaxCRM — Architecture

ParallaxCRM is an enterprise customer relationship platform built as a **modular monolith**:

```
Browser
  │
  ▼
Next.js (Vercel)            UI, TanStack Query cache, same-origin /api/* rewrite
  │  HTTPS, same origin
  ▼
Spring Boot (Render)        REST API → module services → rich domain entities → repositories
  │  JDBC
  ▼
PostgreSQL (Neon / Docker)  single source of truth, schema owned by Flyway
```

The project is a ground-up rebuild of an earlier Java OOP coursework project ("Salesforce CRM System").
The domain concepts from that project — leads, contacts, opportunities, the account hierarchy, sales reps,
interfaces, polymorphism, exceptions, collections, concurrency — are kept where they add real value, but the
architecture is designed as a production-style web application, not as a replica of the classroom design.

## Non-negotiable: live data only

PostgreSQL is the only source of truth for application data (see [ADR 0004](adr/0004-live-data-only.md)).

- The frontend never contains CRM records, metrics, chart series, user lists or business results.
- No mock repositories, fixtures or fake API responses exist in the production code path.
  MSW and fixtures are allowed only under `frontend/test` and `frontend/e2e`, and a lint rule enforces this.
- Backend tests run against real PostgreSQL via Testcontainers using the production Flyway migrations. There is no H2.
- Seed data is only ever *initial* database data, created explicitly, and never reset automatically.
- The application must work correctly against an empty database.

## Backend

### Module layout (Spring Modulith)

Package-by-feature under `com.parallaxcrm`. Each top-level package is an application module; the module's
top-level package is its public API, and sub-packages are internal. Boundaries are verified in a test
(`ModularityTests`), so an illegal cross-module dependency fails the build.

| Module | Responsibility | Status |
|---|---|---|
| `shared` | Base entity, error model (`ParallaxException` family), ProblemDetail handler, paging, request IDs. Open module. | A0 |
| `leads` | Lead lifecycle and ownership, status workflow, conversion into account + contact + opportunity | A0–A3 |
| `audit` | Immutable change log, written synchronously in the same transaction as the change | A0 (write path) |
| `identity` | Users, sign-in, database-backed sessions, roles, `AccessPolicy`, user administration | A1 |
| `salesteam` | Sales profiles (territory, title, quota) of users with a sales role, plus live figures (YTD sales, attainment, pipeline) computed from owned records | A2 |
| `accounts` | Account hierarchy (Enterprise / SMB / Startup) with per-subtype tier and support rules | A2 |
| `contacts` | People at accounts; one primary contact per account | A2 |
| `opportunities` | Deals on accounts, stage-transition workflow and history, pipeline totals and Kanban board | A2–A3 |
| `activities` | Timeline of logged calls, emails, meetings and notes, plus workflow events; per-record access through `TimelineAccess` | A3 |
| `search`, `analytics` | Read-only cross-entity queries | B2, A4 |
| `intelligence` | Scoring, risk, recommendations — listens to events, core never depends on it | C |

Inside a module:

```
leads/
  LeadService.java          public API used by other modules and the web layer
  LeadStatus, LeadSource    public vocabulary (enums)
  internal/                 entities, repositories, query specifications (module-private)
  web/                      controller + request/response DTOs
```

### Domain model

JPA entities are the domain model ([ADR 0005](adr/0005-rich-jpa-entities.md)). They own their invariants:
construction goes through factory methods that validate input, state changes go through intention-revealing methods
(`lead.convert(...)`, `opportunity.moveTo(stage)`), and there are no public setters for invariant-protected state.

The account hierarchy uses JPA `JOINED` inheritance (`accounts` + `enterprise_accounts` / `smb_accounts` /
`startup_accounts`). Each subtype derives its own `tier()` and `supportLevel()` from its own attributes:

| Subtype | Tier | Support |
|---|---|---|
| `EnterpriseAccount` | `STRATEGIC` from $1B revenue or 10,000 global employees, else `MAJOR` | `DEDICATED` with an enterprise support contract, else `PRIORITY` |
| `SmbAccount` | `ESTABLISHED` after 5 years in business, else `EMERGING` | `STANDARD` |
| `StartupAccount` | By funding round: `EARLY_STAGE` (to seed), `GROWTH_STAGE` (A–B), `LATE_STAGE` (C+) | `PRIORITY` when late stage, else `STANDARD` |

An account's type is fixed at creation. Opportunities derive probability from their stage (overridable while open,
forced to 100/0 when closed) and record every stage they enter in `opportunity_stage_history`, in the same transaction.

### Workflows (A3)

Business actions are explicit sub-resources, never a side effect of a generic edit ([ADR 0008](adr/0008-opportunity-stage-workflow.md)):

| Action | Endpoint | Writes, in one transaction |
|---|---|---|
| Lead status change | `POST /leads/{id}/status-transitions` | lead, `UPDATE` audit, `RECORD_UPDATE` activity |
| Lead conversion | `POST /leads/{id}/conversion` | account (or link to existing), contact, opportunity + first stage history, their `CREATE` audits, lead `CONVERT` audit, `LEAD_CONVERSION` activity |
| Stage transition | `POST /opportunities/{id}/stage-transitions` | opportunity, stage history row, `STAGE_CHANGE` audit, `STAGE_CHANGE` activity |
| Reassignment | `PUT /opportunities/{id}` with a new owner | opportunity, `UPDATE` audit, `ASSIGNMENT` activity |

Stage rules live on `OpportunityStage`; every opportunity and pipeline card carries the `allowedStages` the viewer may
move it to, so the UI never re-implements them. Workflow errors are `409` with a specific code
(`INVALID_STATE_TRANSITION`, `ALREADY_CONVERTED`); a stale `version` is `409 CONFLICT`.

**Activities** link to one or more of lead, account, contact and opportunity (a conversion links all four). The
`activities` module never depends on those modules: each contributes a `TimelineAccess` bean, so reading or adding to
a timeline follows exactly the access rules of the record itself (reps: their own leads and deals; everyone: accounts
and contacts). People log `CALL`, `EMAIL`, `MEETING` and `NOTE`; the other types are written only by workflows.

**Cross-module composition.** `contacts`, `opportunities` and `salesteam` depend on `accounts` (and `salesteam` on
`leads` and `opportunities` for its figures); nothing depends back on them. The account page is therefore composed by
the frontend from `GET /accounts/{id}`, `GET /contacts?accountId=`, `GET /opportunities?accountId=` and
`GET /opportunities/summary?accountId=` rather than by an account endpoint reaching into other modules.

### Errors

All errors are RFC 7807 `ProblemDetail` responses with a stable machine-readable `code`:

| Code | HTTP | Source |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Bean Validation, with `fieldErrors[]` |
| `BAD_REQUEST` | 400 | Malformed JSON, bad parameters |
| `RECORD_NOT_FOUND` | 404 | `RecordNotFoundException` |
| `DUPLICATE_RECORD` | 409 | `DuplicateRecordException`, or a `uq_*` database constraint |
| `CONFLICT` | 409 | Optimistic-lock version mismatch |
| `INVALID_STATE_TRANSITION` | 409 | A workflow move the record's state doesn't allow (stage skip, unqualified lead) |
| `ALREADY_CONVERTED` | 409 | Converting, or changing the status of, a lead that is already converted |
| `DATA_INTEGRITY` | 409 | Other database constraint violations |
| `PERMISSION_DENIED` | 403 | `PermissionDeniedException` (A1) |
| `INTERNAL_ERROR` | 500 | Anything unexpected — logged with the request ID; never includes a stack trace |

Every response carries an `X-Request-Id` header, and error bodies include `requestId` so users can report it.

### Concurrency

Every mutable table has a `version` column mapped with `@Version`. Update commands must carry the version the client
last saw; a mismatch returns `409 CONFLICT` with the current server state so the UI can show a conflict dialog.

### Audit and activities

Audit rows and system activity rows are written **synchronously inside the transaction** that performs the change,
so they commit or roll back with it. Asynchronous after-commit listeners are reserved for non-critical consumers
(real-time push, intelligence) and will use Spring Modulith's event publication registry when introduced.

## Database

PostgreSQL 17 (local Docker on host port 5433, Testcontainers in tests, Neon in production). Flyway owns the schema (`db/migration`); Hibernate runs with `ddl-auto: validate`.

Conventions:

- UUID primary keys (UUIDv7, generated application-side and time-ordered) plus a human-readable `number`
  (`LD-000042`, `ACC-000007`, …) generated by a database sequence.
- `created_at` / `updated_at` as `timestamptz`, `archived_at` for soft archive, `version` for optimistic locking.
- Enumerations stored as `varchar` with `CHECK` constraints; money as `numeric(15,2)` (single currency in v1).
- Case-insensitive uniqueness via unique indexes on `lower(...)`, named `uq_*` so violations map to `DUPLICATE_RECORD`.
- `pg_trgm` GIN indexes for search on names, companies and emails.
- Derived values (YTD sales, attainment, pipeline totals) are computed by queries, not stored.

V3 (A2) makes every contact belong to an account, lets the database assign subsidiary row ids, and adds CHECK
constraints for opportunity lead sources and stage-history stages. V1 creates the full core relational model — users, sales reps, the account hierarchy, contacts, leads, opportunities,
stage history, activities and audit events — so cross-entity foreign keys exist from the start. Framework tables
(Spring Session, event publication) arrive with the phases that need them.

## API

- Base path `/api/v1`; OpenAPI at `/v3/api-docs`, Swagger UI at `/swagger-ui.html` (disabled in production by default).
- List endpoints: `?page=0&size=25&sort=createdAt,desc&…filters` → `{ content, page, size, totalElements, totalPages }`.
  Page size is capped at 100 and sort fields are whitelisted per resource.
- Business actions are sub-resources (`POST /leads/{id}/conversion`, `POST /opportunities/{id}/stage-transitions`).
- Health: `/actuator/health` (with liveness/readiness groups).

## Frontend

- Next.js App Router + TypeScript + Tailwind + shadcn/ui.
- All CRM data is fetched from the API through TanStack Query hooks in `src/features/*/api.ts`.
  The server's response is always authoritative; optimistic updates are reconciled or rolled back. On the Kanban
  board (`/pipeline`, dnd-kit) a dropped card moves at once, the real stage-transition API decides, and the board is
  refetched either way; only cards move optimistically — column counts and totals are always the server's.
- Types come from the backend's OpenAPI document (`npm run api:types` → `src/lib/api/schema.d.ts`). Response
  record fields are required in the schema unless annotated with JSpecify `@Nullable`, so the TypeScript types mirror
  Java nullability exactly. CI fails if the committed types drift from the backend.
- `next.config.ts` rewrites `/api/*` to `BACKEND_URL`, so the browser only talks to the frontend origin:
  no CORS, and first-party session cookies.
- URL-driven list state (search, filters, sort, page) written with the native History API, so views are shareable
  and survive refresh without a server round trip per keystroke. Only the request is debounced, never the URL write.
- Per-device conveniences only (theme, sidebar collapse) may live in browser storage.

## Authentication and authorization

Implemented in A1 ([ADR 0002](adr/0002-session-authentication.md)).

**Sessions.** `POST /api/v1/auth/login` verifies the password (BCrypt via Spring's delegating encoder), invalidates any
session already present in the browser, and starts a new one stored in PostgreSQL by Spring Session JDBC. The
`PARALLAX_SESSION` cookie is `HttpOnly; SameSite=Lax` and `Secure` everywhere except plain-http local development.
Sessions last 8 hours of inactivity. Anonymous requests never create sessions.

**What the session holds.** Only the user's id (as the principal name) and role, using JDK/Spring types, so deploys
never break existing sessions. `CurrentUser` reloads the user from the database once per request, so a role change or
deactivation applies on the very next request. Role changes, deactivation and password changes also delete the
affected sessions (Spring Session's principal-name index).

**CSRF.** Cookie-to-header: the readable `XSRF-TOKEN` cookie is echoed in `X-XSRF-TOKEN` on every write. The frontend
fetches `GET /api/v1/auth/csrf` when the cookie is missing (for example right after sign-in, which rotates the token).

**Brute force and enumeration.** Unknown email, wrong password and deactivated account all return the same
`401 UNAUTHENTICATED` message, with equalised hashing time. Five failures lock that email for 15 minutes
(`429 RATE_LIMITED` with `Retry-After`). The limiter is in memory, which is correct for the single backend instance.

**Authorization.** All decisions go through `identity.AccessPolicy`, which throws `PermissionDeniedException`
(`403 PERMISSION_DENIED`). Modules call it before acting; the UI hides actions using the `permissions` returned by
`GET /api/v1/auth/me`, but never relies on that.

| Capability | ADMIN | SALES_MANAGER | SALES_REP |
|---|---|---|---|
| Leads and opportunities: see and work others' | ✓ | ✓ | — (own only; asking for others' is a 403) |
| Accounts and contacts: read | ✓ | ✓ | ✓ (shared reference data) |
| Accounts and contacts: edit | ✓ | ✓ | Own records only |
| Assign any record to other people | ✓ | ✓ | — (always the owner of what they create) |
| Archive / restore accounts, contacts, opportunities | ✓ | ✓ | — |
| Sales profiles (territory, quota) | ✓ edit | ✓ edit | Own profile, read-only |
| View the user directory | ✓ | ✓ | — |
| Create users (including sales reps), change roles, deactivate | ✓ | — | — |

Sales managers have organisation-wide scope. Team-scoped managers were considered and deliberately not built: the
permission model stays one rule per record type ([ADR 0007](adr/0007-record-visibility.md)). Pipeline totals and
account opportunity lists respect the same visibility, so a rep's figures only ever include their own deals.

Admins cannot change their own role or deactivate themselves, so an organisation always keeps an active admin.

**First admin.** `AdminBootstrap` creates one only when the `users` table is empty and `ADMIN_BOOTSTRAP_EMAIL` /
`ADMIN_BOOTSTRAP_PASSWORD` are set (the `local` profile supplies development defaults). Passwords need 12–72 characters.

**Frontend.** `src/proxy.ts` redirects requests without a session cookie to `/login?next=…` (an optimistic check only).
Any `401` from the API sends the browser to `/login` with a full page load, which discards every cached query.
`next` is restricted to same-site paths.

## Deployment

| Piece | Host | Notes |
|---|---|---|
| Frontend | Vercel | Root directory `frontend/`, env `BACKEND_URL` |
| Backend | Render (Docker) | `backend/Dockerfile`, health check `/actuator/health`, Flyway migrates on boot |
| Database | Neon | Direct (non-pooled) JDBC URL; `sslmode=require` |

Configuration is provider-agnostic ([ADR 0003](adr/0003-postgresql-neon-provider-agnostic.md)): the backend only reads
`DATABASE_URL` (JDBC form), `DATABASE_USERNAME` and `DATABASE_PASSWORD`. Local Docker and Neon differ only in values.

## Roadmap

| Phase | Scope |
|---|---|
| **A0** ✅ | Foundations + Lead vertical slice (PostgreSQL → API → UI), CI, Docker, health checks |
| **A1** ✅ | Authentication, roles, access policy |
| **A2** ✅ | Sales reps, account hierarchy, contacts, opportunities: CRUD, archive/restore, search, filters, permissions |
| **A3** ✅ | Lead status and conversion, opportunity stage workflow + history, Kanban pipeline, activity timeline, conflict handling |
| A4 | Live dashboard and analytics queries |
| B | Audit viewer, command palette + search, CSV import/export, polish |
| Later | SSE real-time updates; intelligence module |
