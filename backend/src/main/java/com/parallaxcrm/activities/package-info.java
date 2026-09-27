/**
 * Activities: the user-facing timeline of calls, emails, meetings and notes people log, plus the workflow events the
 * system records (stage changes, lead conversions, assignments). System activities are written synchronously in the
 * transaction of the change they describe, like audit events.
 *
 * <p>This module never depends on the modules whose records it links to. Each of them contributes a
 * {@link com.parallaxcrm.activities.TimelineAccess} that decides who may read or add to that record's timeline.
 */
@ApplicationModule(displayName = "Activities")
package com.parallaxcrm.activities;

import org.springframework.modulith.ApplicationModule;
