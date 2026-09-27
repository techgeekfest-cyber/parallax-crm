package com.parallaxcrm.activities;

import java.util.UUID;

/**
 * Implemented by each module whose records have a timeline, so access to a timeline follows exactly the same rules as
 * access to the record itself. Implementations throw the usual {@code RecordNotFoundException} or
 * {@code PermissionDeniedException}.
 */
public interface TimelineAccess {

    ActivityTarget target();

    /** Anyone who may open the record may read its timeline. */
    void requireCanView(UUID recordId);

    /** Logging an activity additionally needs the record to be live (not archived). */
    void requireCanLog(UUID recordId);
}
