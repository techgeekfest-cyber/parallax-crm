package com.parallaxcrm.opportunities;

/** Pipeline stages, in order, with the win probability a deal typically has at each one. */
public enum OpportunityStage {
    PROSPECTING(10),
    QUALIFICATION(25),
    PROPOSAL(50),
    NEGOTIATION(75),
    CLOSED_WON(100),
    CLOSED_LOST(0);

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
}
