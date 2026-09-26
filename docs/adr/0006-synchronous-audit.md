# ADR 0006 — Audit and activity rows are written in the same transaction

**Status:** Accepted

## Context

The audit trail and activity timeline must be trustworthy: every committed change must have its record, and a
rolled-back change must not. After-commit event listeners can lose records if the process dies between the commit and
the listener.

## Decision

- Module services write audit rows (and, from B1, activity rows) **synchronously inside the same transaction** as the
  business change, through the `audit` module's public `AuditTrail` API.
- Asynchronous, after-commit listeners are reserved for non-critical consumers (future SSE push, intelligence) and
  will use Spring Modulith's persistent event publication registry when they are introduced.

## Consequences

- Audit completeness is guaranteed by the database transaction.
- Business modules depend on `audit`'s public API. This is an explicit, verified dependency, not a hidden coupling.
