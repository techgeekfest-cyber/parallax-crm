/**
 * Immutable change log. Business modules record audit events synchronously, inside the same transaction as the
 * change they describe (ADR 0006).
 */
@ApplicationModule(displayName = "Audit")
package com.parallaxcrm.audit;

import org.springframework.modulith.ApplicationModule;
