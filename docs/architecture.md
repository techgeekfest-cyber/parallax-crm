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
| `leads` | Lead lifecycle; later conversion workflow | A0 (create/read/list) |
| `audit` | Immutable change log, written synchronously in the same transaction as the change | A0 (write path) |
| `identity` | Users, sessions, roles, access policy | A1 |
| `salesteam` | Sales rep profiles, quotas, territories | A2 |
| `accounts` | Account hierarchy (Enterprise / SMB / Startup) | A2 |
| `contacts` | Contacts | A2 |
| `opportunities` | Pipeline, stage machine, stage history | A2–A3 |
| `activities` | User-facing timeline | B1 |
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
`startup_accounts`), with polymorphic behaviour such as `tier()` and `supportLevel()` overridden per subtype.

### Errors

All errors are RFC 7807 `ProblemDetail` responses with a stable machine-readable `code`:

| Code | HTTP | Source |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Bean Validation, with `fieldErrors[]` |
| `BAD_REQUEST` | 400 | Malformed JSON, bad parameters |
| `RECORD_NOT_FOUND` | 404 | `RecordNotFoundException` |
| `DUPLICATE_RECORD` | 409 | `DuplicateRecordException`, or a `uq_*` database constraint |
| `CONFLICT` | 409 | Optimistic-lock version mismatch |
| `DATA_INTEGRITY` | 409 | Other database constraint violations |
| `PERMISSION_DENIED` | 403 | `PermissionDeniedException` (A1) |
| `INTERNAL_ERROR` | 500 | Anything unexpected — logged with the request ID; never includes a stack trace |

Every response carries an `X-Request-Id` header, and error bodies include `requestId` so users can report it.

### Concurrency

Every mutable table has a `version` column mapped with `@Version`. Update commands must carry the version the client
last saw; a mismatch returns `409 CONFLICT` with the current server state so the UI can show a conflict dialog.

### Audit and activities

Audit rows (and, from B1, activity rows) are written **synchronously inside the transaction** that performs the change,
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

V1 creates the full core relational model — users, sales reps, the account hierarchy, contacts, leads, opportunities,
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
  The server's response is always authoritative; optimistic updates are reconciled or rolled back.
- Types come from the backend's OpenAPI document (`npm run api:types` → `src/lib/api/schema.d.ts`). Response
  record fields are required in the schema unless annotated with JSpecify `@Nullable`, so the TypeScript types mirror
  Java nullability exactly. CI fails if the committed types drift from the backend.
- `next.config.ts` rewrites `/api/*` to `BACKEND_URL`, so the browser only talks to the frontend origin:
  no CORS, and first-party session cookies.
- URL-driven list state (search, filters, sort, page) written with the native History API, so views are shareable
  and survive refresh without a server round trip per keystroke. Only the request is debounced, never the URL write.
- Per-device conveniences only (theme, sidebar collapse) may live in browser storage.

## Authentication and authorization (A1)

- Email + password (BCrypt), Spring Security with Spring Session JDBC, `HttpOnly; Secure; SameSite=Lax` cookie,
  cookie-to-header CSRF ([ADR 0002](adr/0002-session-authentication.md)).
- Roles: `ADMIN`, `SALES_MANAGER`, `SALES_REP`. Role checks via `@PreAuthorize`; record-level checks via an
  `AccessPolicy` that throws `PermissionDeniedException`. The UI hides actions using server-provided permission flags,
  but the backend always enforces.
- The first admin is created only when the `users` table is empty and `ADMIN_BOOTSTRAP_EMAIL` /
  `ADMIN_BOOTSTRAP_PASSWORD` are set.

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
| **A0** | Foundations + Lead vertical slice (PostgreSQL → API → UI), CI, Docker, health checks |
| A1 | Authentication, roles, access policy |
| A2 | Sales reps, accounts, contacts, opportunities, full lead CRUD, archive/restore |
| A3 | Lead conversion, opportunity stage machine + history, Kanban, conflict handling |
| A4 | Live dashboard and analytics queries |
| B | Activity timeline, audit viewer, command palette + search, CSV import/export, polish |
| Later | SSE real-time updates; intelligence module |
