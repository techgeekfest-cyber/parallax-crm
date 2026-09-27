# ADR 0008 — Opportunity stages and lead status change only through explicit workflow actions

**Status:** Accepted

## Context

Until A2, an opportunity's stage was an ordinary field on `PUT /opportunities/{id}`: any edit could jump a deal from
Prospecting to Closed won, and the pipeline history showed whatever the last form submission said. Leads had no status
changes at all, so nothing could be qualified or converted. A sales CRM needs these moves to follow rules, to be
recorded, and to be safe when two people work the same record.

## Decision

**Stages move through `POST /opportunities/{id}/stage-transitions`, never through an edit.** `PUT` rejects a changed
`stage` (`400`, field `stage`); creating an opportunity may still set its starting stage, including a closed one, so
already-closed deals can be recorded.

The transition rules live on `OpportunityStage` and are exposed per record as `allowedStages`, so the UI never
duplicates them:

| From | May move to |
|---|---|
| Prospecting | Qualification, Closed lost |
| Qualification | Prospecting, Proposal, Closed lost |
| Proposal | Qualification, Negotiation, Closed lost |
| Negotiation | Proposal, Closed won, Closed lost |
| Closed won / Closed lost | any open stage (reopen) |

- **One step at a time.** Skipping stages would leave history that doesn't describe how the deal progressed.
- **Won only from Negotiation; lost from anywhere.** Deals die at any point, but are only won after negotiating.
- **Reopening goes to any open stage, chosen by the person reopening.** A reopened deal rarely resumes where it
  stopped, and forcing a fixed re-entry stage would just produce an immediate second transition. Won and lost never
  switch directly — reopen first — so a mistaken close is visible in history.
- **Probability resets to the new stage's default** on every transition (closed stages force 100 / 0). A stage change
  is a new assessment; people can still fine-tune probability with an edit while the deal is open.

Each transition, in one transaction: permission check (owner, manager, admin), version check (`409 CONFLICT` if stale),
rule check (`409 INVALID_STATE_TRANSITION`), the change itself, a `opportunity_stage_history` row, a `STAGE_CHANGE`
audit event and a `STAGE_CHANGE` timeline activity (with the optional note).

**Lead status** moves through `POST /leads/{id}/status-transitions` between New, Contacted, Qualified and Disqualified
in any direction (qualification is a judgement people revise). `CONVERTED` is reached only by
`POST /leads/{id}/conversion`, only from Qualified, and is final (`409 ALREADY_CONVERTED` for anything afterwards).

**Conversion is one transaction** across modules: the `leads` module locks the lead row (`SELECT … FOR UPDATE`), then
calls the public `createFromLead` methods of `accounts`, `contacts` and `opportunities` — the same rules, permission
checks and audit events as their normal create — then marks the lead converted and writes its `CONVERT` audit event
and a `LEAD_CONVERSION` activity linked to all four records. Any failure rolls back everything. The row lock makes a
concurrent second attempt wait and then fail with `ALREADY_CONVERTED`.

## Consequences

- The Kanban board, the detail page and the API cannot disagree about what is allowed.
- Stage history and the timeline describe every move, by whom, and why (the note).
- `leads` depends on `accounts`, `contacts` and `opportunities`. None of them depends back on `leads`, so the module
  graph stays acyclic (verified by `ModularityTests`).
