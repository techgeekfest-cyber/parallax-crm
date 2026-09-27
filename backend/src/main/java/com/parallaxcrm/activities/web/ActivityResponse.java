package com.parallaxcrm.activities.web;

import com.parallaxcrm.activities.ActivityType;
import com.parallaxcrm.activities.internal.Activity;
import com.parallaxcrm.identity.UserSummary;
import com.parallaxcrm.shared.web.UserRefResponse;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.UUID;

public record ActivityResponse(
        UUID id,
        ActivityType type,
        String subject,
        @Nullable String body,
        @Nullable UserRefResponse actor,
        Instant occurredAt,
        /* true when a workflow wrote it (stage change, conversion …) rather than a person logging it */
        boolean system,
        @Nullable UUID leadId,
        @Nullable UUID accountId,
        @Nullable UUID contactId,
        @Nullable UUID opportunityId) {

    static ActivityResponse from(Activity activity, UserSummary actor) {
        return new ActivityResponse(activity.getId(), activity.getType(), activity.getSubject(), activity.getBody(),
                UserSummary.ref(actor), activity.getOccurredAt(), !activity.getType().isManual(),
                activity.getLeadId(), activity.getAccountId(), activity.getContactId(), activity.getOpportunityId());
    }
}
