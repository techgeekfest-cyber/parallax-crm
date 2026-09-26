# ADR 0005 — JPA entities are the domain model

**Status:** Accepted

## Context

Clean-architecture purists separate a framework-free domain model from persistence entities and map between them.
For a CRM of this size that doubles the class count and adds mapping bugs, especially around the polymorphic account
hierarchy.

## Decision

JPA entities are the domain model, and they are **rich**:

- Construction through validating factory methods; a protected no-arg constructor exists only for JPA.
- State changes through intention-revealing methods (`convert`, `moveTo`, `assignTo`, `archive`) that enforce
  invariants and throw domain exceptions. No public setters for invariant-protected state.
- Entities live in a module's `internal` package and never leave the module; the web layer uses DTOs, and other
  modules use the module's public service and read types.
- The database backs every invariant that can be expressed declaratively (`CHECK`, `UNIQUE`, `FOREIGN KEY`).

## Consequences

- Less code, and the OOP concepts (encapsulation, inheritance, polymorphism) are visible where the business logic runs.
- Domain classes carry JPA annotations; this is accepted as a pragmatic trade-off.
