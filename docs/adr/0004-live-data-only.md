# ADR 0004 — Live data only: PostgreSQL is the single source of truth

**Status:** Accepted

## Context

ParallaxCRM is meant to be a genuinely functional application, not a UI mockup. Portfolio projects often hide
hardcoded data behind a polished UI; this project explicitly must not.

## Decision

1. Every CRM record, metric, count, chart series, activity, audit event, user and permission shown in the UI comes from
   the REST API, which reads it from PostgreSQL.
2. The frontend's production code (`frontend/src`) must not import mocks or fixtures. An ESLint
   `no-restricted-imports` rule blocks `msw` and any `mocks`/`fixtures` path. Test doubles live only in
   `frontend/test` and `frontend/e2e`.
3. The backend has no in-memory or fake repositories and no "mock" profile. Integration tests use Testcontainers
   PostgreSQL with the production Flyway migrations. H2 is not used.
4. Seed data exists only as initial database content, created by an explicit command that refuses to run on a
   non-empty database. There is no automatic or scheduled reset. Any demo reset is an explicit, audited ADMIN action,
   disabled by default.
5. Every screen has a designed empty state, and aggregates handle zero rows (for example, win rate with no closed
   deals is `null`, shown as "—").
6. Optimistic UI updates are allowed, but the server response always wins: updates are reconciled with it or rolled back.

## Definition of Done for any feature

Persisted through Flyway-managed schema · exposed via the REST API and OpenAPI · rules and permissions enforced on the
backend (with 403/409 tests) · integration-tested on real PostgreSQL · works on an empty database · UI data survives
refresh and log-out/log-in · writes produce the expected audit (and activity) rows.
