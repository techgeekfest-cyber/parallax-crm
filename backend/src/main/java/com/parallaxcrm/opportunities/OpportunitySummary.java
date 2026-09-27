package com.parallaxcrm.opportunities;

import java.util.UUID;

/** Minimal public view of an opportunity for other modules (lead conversion). */
public record OpportunitySummary(UUID id, String number, String name, OpportunityStage stage, UUID ownerId) {
}
