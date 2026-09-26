# ADR 0003 — PostgreSQL on Neon, provider-agnostic configuration

**Status:** Accepted

## Context

The application needs a relational database with strong constraints, JSON support for audit data, and trigram
search. Production hosting should be free-tier friendly and durable; local development should need nothing but Docker.

## Decision

- PostgreSQL 17 everywhere: `postgres:17-alpine` locally and in Testcontainers, Neon in production.
- Flyway owns the schema. Hibernate only validates it.
- The backend reads exactly three database settings: `DATABASE_URL` (JDBC form), `DATABASE_USERNAME`,
  `DATABASE_PASSWORD`, plus an optional `DATABASE_POOL_SIZE`. Local and production differ only in values.
- In production use Neon's **direct** (non-pooled) endpoint with `sslmode=require`. The backend runs as a single
  instance with a small Hikari pool, and Flyway's session-level locks are not compatible with transaction-mode
  PgBouncer.

## Consequences

- Switching providers is a configuration change.
- Neon connection strings (`postgresql://user:pass@host/db`) must be converted to JDBC form
  (`jdbc:postgresql://host/db?sslmode=require`) with the user and password passed separately. The README documents this.
