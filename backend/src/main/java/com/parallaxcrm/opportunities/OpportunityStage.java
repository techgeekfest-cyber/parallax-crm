package com.parallaxcrm.opportunities;

import java.util.EnumSet;
import java.util.Set;

/**
 * Pipeline stages, in order, with the win probability a deal typically has at each one.
 *
 * <p>The stage workflow (see docs/adr/0008-opportunity-stage-workflow.md):
 * <ul>
 *   <li>Open deals move one stage at a time, forwards or back: Prospecting ⇄ Qualification ⇄ Proposal ⇄ Negotiation.
 *       Skipping stages is not allowed, so every deal's history shows how it progressed.</li>
 *   <li>Only a deal in Negotiation can be won. A deal can be lost from any open stage.</li>
 *   <li>A closed deal (won or lost) can be reopened into any open stage — the person reopening it decides where it
 *       really stands. Won and lost never switch directly; reopen first.</li>
 * </ul>
 */
public enum OpportunityStage {
    PROSPECTING(10),
    QUALIFICATION(25),
    PROPOSAL(50),
    NEGOTIATION(75),
    CLOSED_WON(100),
    CLOSED_LOST(0);

    private static final OpportunityStage[] OPEN = {PROSPECTING, QUALIFICATION, PROPOSAL, NEGOTIATION};

    private final int defaultProbability;

    OpportunityStage(int defaultProbability) {
        this.defaultProbability = defaultProbability;
    }

    public int defaultProbability() {
        return defaultProbability;
    }

    public boolean isClosed() {
        return this == CLOSED_WON || this == CLOSED_LOST;
    }

    /** The stages a deal in this stage may move to next, in pipeline order. */
    public Set<OpportunityStage> allowedTransitions() {
        if (isClosed()) {
            return EnumSet.of(PROSPECTING, QUALIFICATION, PROPOSAL, NEGOTIATION);
        }
        Set<OpportunityStage> next = EnumSet.of(CLOSED_LOST);
        int index = ordinal();
        if (index > 0) {
            next.add(OPEN[index - 1]);
        }
        if (index < OPEN.length - 1) {
            next.add(OPEN[index + 1]);
        } else {
            next.add(CLOSED_WON);
        }
        return next;
    }

    public boolean canTransitionTo(OpportunityStage next) {
        return next != null && allowedTransitions().contains(next);
    }

    /** The name people see, for messages and timeline entries ("Closed won"). */
    public String label() {
        String words = name().replace('_', ' ').toLowerCase(java.util.Locale.ROOT);
        return Character.toUpperCase(words.charAt(0)) + words.substring(1);
    }
}
