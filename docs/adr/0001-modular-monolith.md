# ADR 0001 — Modular monolith with Spring Modulith

**Status:** Accepted

## Context

ParallaxCRM has around ten business capabilities (leads, accounts, contacts, opportunities, sales team, activities,
audit, search, analytics, and later intelligence). It is built and operated by one developer and deployed to a single
Render instance. It needs clear internal boundaries so that features can grow — and an intelligence layer can be
added later — without turning into a tangle.

## Decision

Build a single Spring Boot application organised **by feature** into application modules, and use
**Spring Modulith** to verify module boundaries in a test (`ApplicationModules.of(...).verify()`).

- Each top-level package under `com.parallaxcrm` is a module. Its top-level package is the public API;
  sub-packages (`internal`, `web`) are private to the module.
- `shared` is an open module holding cross-cutting building blocks.
- Modules communicate by calling other modules' public services or by domain events.

## Consequences

- One deployable, one database, one transaction boundary — simple to run on free-tier hosting.
- Boundary violations fail CI instead of relying on discipline.
- If a module ever needs to be extracted, its dependencies are already explicit.
- Rejected: microservices (operational cost with no benefit at this scale); layer-first packaging
  (`controller/`, `service/`, …), which hides feature boundaries.
