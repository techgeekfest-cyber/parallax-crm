# ParallaxCRM

**Enterprise Customer Relationship Platform** — leads, accounts, contacts, opportunities, pipeline and analytics,
built as a real full-stack application: Next.js → Spring Boot → PostgreSQL.

> Status: **Phase A2 — core CRM.** Leads, accounts (Enterprise / SMB / Startup), contacts, opportunities and sales reps,
> with search, filters, pagination, archiving and role-based permissions, all backed by PostgreSQL.
> See the [roadmap](#roadmap).

ParallaxCRM is a ground-up rebuild of a Java OOP coursework project. The original domain model — leads, contacts,
opportunities, an `Account` hierarchy (Enterprise / SMB / Startup), sales reps — is kept, but redesigned as a
production-style modular monolith with a real database, a documented REST API, automated tests and CI.

## Principles

- **Live data only.** PostgreSQL is the single source of truth. The frontend contains no hardcoded records, metrics or
  fixtures, and a lint rule enforces it ([ADR 0004](docs/adr/0004-live-data-only.md)).
- **Modular monolith.** Package-by-feature Spring Boot modules with boundaries verified by Spring Modulith in CI
  ([ADR 0001](docs/adr/0001-modular-monolith.md)).
- **Database-enforced invariants.** Flyway-managed schema with `CHECK`, `UNIQUE` and foreign-key constraints backing the
  domain rules.
- **Trustworthy history.** Audit events are written in the same transaction as the change they describe
  ([ADR 0006](docs/adr/0006-synchronous-audit.md)).

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui (Base UI), TanStack Query, React Hook Form + Zod |
| Backend | Java 25, Spring Boot 4.1, Spring Data JPA, Spring Modulith, Bean Validation, springdoc-openapi |
| Database | PostgreSQL 17, Flyway |
| Testing | JUnit 5, AssertJ, Testcontainers, Vitest, Testing Library, Playwright |
| Delivery | Docker, GitHub Actions, Vercel (frontend), Render (backend), Neon (PostgreSQL) |

## Repository layout

```
.
├── backend/                 Spring Boot API (Maven)
│   └── src/main/java/com/parallaxcrm/
│       ├── shared/          base entity, error model, paging, request IDs (open module)
│       ├── identity/        users, sign-in, sessions, roles, access policy
│       ├── leads/           Lead module: public service, internal domain, web layer
│       ├── accounts/        account hierarchy (Enterprise / SMB / Startup)
│       ├── contacts/        people at accounts
│       ├── opportunities/   deals, pipeline totals, stage history
│       ├── salesteam/       sales profiles and live rep figures
│       └── audit/           immutable audit trail
├── frontend/                Next.js app
│   ├── src/app/             routes
│   ├── src/features/        feature modules (leads, accounts, contacts, opportunities, sales-reps, users…)
│   ├── src/lib/api/         typed API client generated from OpenAPI
│   ├── test/                unit tests (Vitest)
│   └── e2e/                 end-to-end tests (Playwright)
├── docs/
│   ├── architecture.md
│   └── adr/                 architecture decision records
├── docker-compose.yml       local PostgreSQL (+ optional backend container)
├── render.yaml              Render blueprint for the backend
└── .github/workflows/ci.yml
```

## Running locally

**Prerequisites:** Docker, JDK 25, Node.js 24.

```bash
# 1. Database (PostgreSQL 17 on localhost:5433)
docker compose up -d db

# 2. Backend (http://localhost:8080) — Flyway migrates the schema on startup
cd backend
./mvnw spring-boot:run

# 3. Frontend (http://localhost:3000) — in a second terminal
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 and sign in as the development admin that the `local` profile creates on an empty
database: **admin@parallax.local** / **parallax-local-admin**. From **Users** you can add sales managers and reps.
No CRM data is seeded; create your first lead from the Leads page.

Useful URLs while the backend is running:

- Health: http://localhost:8080/actuator/health
- API docs: http://localhost:8080/swagger-ui.html (OpenAPI JSON at `/v3/api-docs`)

The local database uses host port **5433** so it can run alongside other PostgreSQL instances. Override with
`DB_PORT=… docker compose up -d db` and `DATABASE_URL=jdbc:postgresql://localhost:…/parallaxcrm`.

### Tests

```bash
# Backend: unit, integration (Testcontainers PostgreSQL — Docker must be running) and module-boundary tests
cd backend && ./mvnw verify

# Frontend: lint, typecheck, unit tests, production build
cd frontend && npm run lint && npm run typecheck && npm test && npm run build

# End to end (database and backend must be running; Playwright starts the frontend and signs in as the
# bootstrap admin — override with E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD)
cd frontend && npx playwright install chromium && npm run e2e
# Against a freshly migrated, empty database, also run the first-run check:
E2E_FRESH_DB=1 npm run e2e
# Persistence across a backend restart (CI runs this): create, restart the backend, verify
E2E_RESTART_PHASE=before npx playwright test zz-restart-persistence   # then restart the backend
E2E_RESTART_PHASE=after npx playwright test zz-restart-persistence
```

### Regenerating API types

The frontend's types come from the backend's OpenAPI document. After changing an API, with the backend running:

```bash
cd frontend && npm run api:types
```

CI fails if `src/lib/api/schema.d.ts` is out of date.

## Configuration

The backend reads the database connection only from environment variables, so local Docker and Neon use the same
configuration model ([ADR 0003](docs/adr/0003-postgresql-neon-provider-agnostic.md)).

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | backend | JDBC URL, e.g. `jdbc:postgresql://host/db?sslmode=require` |
| `DATABASE_USERNAME` / `DATABASE_PASSWORD` | backend | Database credentials |
| `DATABASE_POOL_SIZE` | backend | Hikari pool size (default 5) |
| `SPRING_PROFILES_ACTIVE` | backend | `local` (default) or `prod` |
| `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` | backend | First admin, created only when there are no users |
| `SESSION_COOKIE_SECURE` | backend | `Secure` cookie flag (default `true`; `false` only for plain-http localhost) |
| `OPENAPI_ENABLED` | backend | Swagger UI and `/v3/api-docs` (default: on locally, off in prod) |
| `BACKEND_URL` | frontend | Backend origin that `/api/*` is proxied to |

See `backend/.env.example` and `frontend/.env.example`.

## Deployment

| Component | Platform | Setup |
|---|---|---|
| Database | Neon | Create a project; copy the **direct** (non-pooled) connection details |
| Backend | Render | New Blueprint from `render.yaml`, then set `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, and for the first deploy `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` |
| Frontend | Vercel | Import the repo with root directory `frontend`; set `BACKEND_URL` to the Render service URL |

Neon shows connection strings as `postgresql://user:password@host/dbname?sslmode=require`. Convert to the JDBC form
`jdbc:postgresql://host/dbname?sslmode=require` and pass the user and password separately.

## API

| Method | Path | Who | Description |
|---|---|---|---|
| `GET` | `/api/v1/auth/csrf` | anyone | Issue the `XSRF-TOKEN` cookie |
| `POST` | `/api/v1/auth/login` | anyone | Sign in; starts a `PARALLAX_SESSION` |
| `POST` | `/api/v1/auth/logout` | signed in | Sign out; deletes the server-side session |
| `GET` | `/api/v1/auth/me` | signed in | Current user and permission flags |
| `PUT` | `/api/v1/auth/password` | signed in | Change password; signs out other sessions |
| `GET` | `/api/v1/users` | admin, manager | List users — `q`, `role`, `active`, paging |
| `GET` | `/api/v1/users/{id}` | admin, manager | Get a user |
| `POST` | `/api/v1/users` | admin | Create a user |
| `PUT` | `/api/v1/users/{id}` | admin | Update name, role, active (with `version`); role/active changes end their sessions |
| `GET` | `/api/v1/leads` | signed in | List leads — `q`, `status`, `ownerId`, paging, `sort`. Reps see only their own |
| `POST` | `/api/v1/leads` | signed in | Create a lead; `ownerId` defaults to you (only managers/admins may assign others) |
| `GET` | `/api/v1/leads/{id}` | owner, manager, admin | Get a lead |
| `GET` `POST` | `/api/v1/accounts` | signed in | List (`q`, `type`, `ownerId`, `archived`, paging, `sort`) / create |
| `GET` `PUT` | `/api/v1/accounts/{id}` | read: all · edit: owner, manager, admin | Get / update (with `version`) |
| `POST` | `/api/v1/accounts/{id}/archive`, `/restore` | manager, admin | Archive / restore |
| `GET` `POST` | `/api/v1/contacts` | signed in | List (`q`, `accountId`, `ownerId`, `archived`…) / create |
| `GET` `PUT` | `/api/v1/contacts/{id}` | read: all · edit: owner, manager, admin | Get / update; making one primary demotes the previous |
| `POST` | `/api/v1/contacts/{id}/archive`, `/restore` | manager, admin | Archive / restore |
| `GET` `POST` | `/api/v1/opportunities` | signed in | List (`q`, `stage`, `accountId`, `ownerId`, `archived`…) / create. Reps see their own |
| `GET` | `/api/v1/opportunities/summary` | signed in | Open, weighted and won totals over what you can see |
| `GET` `PUT` | `/api/v1/opportunities/{id}` | owner, manager, admin | Get (with stage history) / update |
| `POST` | `/api/v1/opportunities/{id}/archive`, `/restore` | manager, admin | Archive / restore |
| `GET` | `/api/v1/sales-reps`, `/api/v1/sales-reps/{id}` | signed in (reps: themselves) | Profiles with YTD sales, attainment, pipeline, record counts |
| `POST` | `/api/v1/sales-reps` | admin | Create a rep's sign-in account and profile together |
| `PUT` | `/api/v1/sales-reps/{id}` | manager, admin | Update territory, title, quota (with `version`) |
| `GET` | `/actuator/health` | anyone | Liveness/readiness, including database connectivity |

Write requests must send the `XSRF-TOKEN` cookie value in the `X-XSRF-TOKEN` header.
Errors use RFC 7807 ProblemDetail with a stable `code` (`VALIDATION_FAILED`, `DUPLICATE_RECORD`, `RECORD_NOT_FOUND`, …),
`fieldErrors` where relevant, and a `requestId` that matches the `X-Request-Id` response header.

## Roadmap

| Phase | Scope |
|---|---|
| **A0** ✅ | Foundation, CI, Docker, Flyway schema, Leads vertical slice |
| **A1** ✅ | Authentication (Spring Session), roles (Admin / Sales Manager / Sales Rep), access policy, user admin |
| **A2** ✅ | Sales reps, account hierarchy, contacts, opportunities; editing, archiving, assignment |
| A3 | Lead conversion, opportunity stage machine and history, Kanban pipeline, conflict handling |
| A4 | Live dashboard and analytics |
| B | Activity timeline, audit viewer, command palette and global search, CSV import/export |
| Later | Real-time updates (SSE), intelligence layer (lead scoring, risk, recommendations) |

Architecture details: [docs/architecture.md](docs/architecture.md).
