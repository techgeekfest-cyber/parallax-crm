package com.parallaxcrm.opportunities;

import com.parallaxcrm.activities.ActivityTarget;
import com.parallaxcrm.activities.TimelineAccess;
import com.parallaxcrm.shared.error.InvalidRequestException;
import org.springframework.stereotype.Component;

import java.util.UUID;

/** An opportunity's timeline is visible to whoever can open the opportunity: its owner, managers and admins. */
@Component
class OpportunityTimelineAccess implements TimelineAccess {

    private final OpportunityService opportunities;

    OpportunityTimelineAccess(OpportunityService opportunities) {
        this.opportunities = opportunities;
    }

    @Override
    public ActivityTarget target() {
        return ActivityTarget.OPPORTUNITY;
    }

    @Override
    public void requireCanView(UUID recordId) {
        opportunities.get(recordId);
    }

    @Override
    public void requireCanLog(UUID recordId) {
        if (opportunities.get(recordId).isArchived()) {
            throw new InvalidRequestException("Restore this opportunity before adding activities to it.");
        }
    }
}
