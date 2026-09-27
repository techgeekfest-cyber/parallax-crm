package com.parallaxcrm.activities;

import java.time.Instant;
import java.util.UUID;

/** A call, email, meeting or note someone logs against one record. {@code occurredAt} null means "now". */
public record NewActivity(
        ActivityType type,
        String subject,
        String body,
        Instant occurredAt,
        ActivityTarget target,
        UUID targetId) {
}
