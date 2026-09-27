package com.parallaxcrm.activities;

import java.util.UUID;

/**
 * The records an activity appears on. A lead conversion links the lead and everything it produced; most activities
 * link a single record. At least one link is required (a database CHECK enforces it too).
 */
public record ActivityLinks(UUID leadId, UUID accountId, UUID contactId, UUID opportunityId) {

    public ActivityLinks {
        if (leadId == null && accountId == null && contactId == null && opportunityId == null) {
            throw new IllegalArgumentException("An activity must be linked to at least one record.");
        }
    }

    public static ActivityLinks to(ActivityTarget target, UUID id) {
        return switch (target) {
            case LEAD -> lead(id);
            case ACCOUNT -> new ActivityLinks(null, id, null, null);
            case CONTACT -> new ActivityLinks(null, null, id, null);
            case OPPORTUNITY -> opportunity(id);
        };
    }

    public static ActivityLinks lead(UUID leadId) {
        return new ActivityLinks(leadId, null, null, null);
    }

    public static ActivityLinks opportunity(UUID opportunityId) {
        return new ActivityLinks(null, null, null, opportunityId);
    }
}
