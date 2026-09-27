# ADR 0007 — Record visibility: shared accounts, owned deals, organisation-wide managers

**Status:** Accepted (A2)

## Context

A2 adds accounts, contacts, opportunities and sales profiles. Each needs a visibility and edit rule that works for
three roles without growing into a rules engine.

## Decision

- **Accounts and contacts are shared reference data.** Every signed-in user can read them, because a rep must be able
  to find an existing company before creating a deal or contact, and duplicate accounts are worse than visible ones.
  Only the owner, a manager or an admin can edit them.
- **Leads and opportunities are owned work.** Reps see and change only their own; managers and admins see everything.
  Aggregates (pipeline totals, an account's opportunity list, sales figures) follow the same rule, so they never leak
  other reps' deal values.
- **Archiving is for managers and admins** on every record type, because it hides a record from everyone.
- **Sales managers are organisation-wide.** The schema has `sales_reps.manager_id`, but team-scoped visibility would add
  a second axis to every query and permission check. It stays out until a real need appears.
- Every rule lives in `identity.AccessPolicy` and is enforced by the API; the UI only mirrors it through the
  `permissions` flags on each record.

## Consequences

- The permission model is one rule per record type, testable as a small matrix.
- Reps can see the names and owners of all accounts. This is intentional; deal amounts stay private to their owners.
- Introducing teams later means changing `AccessPolicy` and the owner filters, not the modules' data model.
