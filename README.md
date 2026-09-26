# ParallaxCRM

**Enterprise Customer Relationship Platform** — leads, accounts, contacts, opportunities, pipeline and analytics,
built as a real full-stack application: Next.js → Spring Boot → PostgreSQL.

> Status: **Phase A0 — foundation.** The first vertical slice (Leads: create, list, search, filter, sort, paginate,
> view) is live end to end. See the [roadmap](#roadmap).

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
│       ├── leads/           Lead module: public service, internal domain, web layer
│       └── audit/           immutable audit trail
├── frontend/                Next.js app
│   ├── src/app/             routes
│   ├── src/features/        feature modules (leads/…)
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

Open http://localhost:3000. The database starts empty; create your first lead from the Leads page.

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

# End to end (database and backend must be running; Playwright starts the frontend)
cd frontend && npx playwright install chromium && npm run e2e
# Against a freshly migrated, empty database, also run the first-run check:
E2E_FRESH_DB=1 npm run e2e
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
| `OPENAPI_ENABLED` | backend | Swagger UI and `/v3/api-docs` (default: on locally, off in prod) |
| `BACKEND_URL` | frontend | Backend origin that `/api/*` is proxied to |

See `backend/.env.example` and `frontend/.env.example`.

## Deployment

| Component | Platform | Setup |
|---|---|---|
| Database | Neon | Create a project; copy the **direct** (non-pooled) connection details |
| Backend | Render | New Blueprint from `render.yaml`, then set `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` |
| Frontend | Vercel | Import the repo with root directory `frontend`; set `BACKEND_URL` to the Render service URL |

Neon shows connection strings as `postgresql://user:password@host/dbname?sslmode=require`. Convert to the JDBC form
`jdbc:postgresql://host/dbname?sslmode=require` and pass the user and password separately.

## API (A0)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/leads` | List leads — `q`, `status`, `page`, `size` (≤ 100), `sort=field,asc\|desc` |
| `POST` | `/api/v1/leads` | Create a lead → `201 Created` with `Location` |
| `GET` | `/api/v1/leads/{id}` | Get a lead |
| `GET` | `/actuator/health` | Liveness/readiness, including database connectivity |

Errors use RFC 7807 ProblemDetail with a stable `code` (`VALIDATION_FAILED`, `DUPLICATE_RECORD`, `RECORD_NOT_FOUND`, …),
`fieldErrors` where relevant, and a `requestId` that matches the `X-Request-Id` response header.

## Roadmap

| Phase | Scope |
|---|---|
| **A0** ✅ | Foundation, CI, Docker, Flyway schema, Leads vertical slice |
| A1 | Authentication (Spring Session), roles (Admin / Sales Manager / Sales Rep), access policy |
| A2 | Sales reps, account hierarchy, contacts, opportunities; editing, archiving, assignment |
| A3 | Lead conversion, opportunity stage machine and history, Kanban pipeline, conflict handling |
| A4 | Live dashboard and analytics |
| B | Activity timeline, audit viewer, command palette and global search, CSV import/export |
| Later | Real-time updates (SSE), intelligence layer (lead scoring, risk, recommendations) |

Architecture details: [docs/architecture.md](docs/architecture.md).
