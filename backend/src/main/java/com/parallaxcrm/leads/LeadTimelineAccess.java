package com.parallaxcrm.leads;

import com.parallaxcrm.activities.ActivityTarget;
import com.parallaxcrm.activities.TimelineAccess;
import org.springframework.stereotype.Component;

import java.util.UUID;

/** A lead's timeline follows the lead's own visibility: its owner, managers and admins. */
@Component
class LeadTimelineAccess implements TimelineAccess {

    private final LeadService leads;

    LeadTimelineAccess(LeadService leads) {
        this.leads = leads;
    }

    @Override
    public ActivityTarget target() {
        return ActivityTarget.LEAD;
    }

    @Override
    public void requireCanView(UUID recordId) {
        leads.get(recordId);
    }

    @Override
    public void requireCanLog(UUID recordId) {
        // Archived leads are hidden (get() treats them as missing); converted leads keep their history open.
        leads.get(recordId);
    }
}
