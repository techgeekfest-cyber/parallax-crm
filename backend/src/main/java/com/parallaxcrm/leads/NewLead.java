package com.parallaxcrm.leads;

import com.parallaxcrm.shared.domain.LeadSource;
import java.math.BigDecimal;
import java.util.UUID;

/** Input for creating a lead through {@link LeadService#create(NewLead)}. */
public record NewLead(
        String firstName,
        String lastName,
        String company,
        String email,
        String phone,
        LeadSource source,
        BigDecimal estimatedValue,
        String notes,
        /* null means "assign to me" */
        UUID ownerId) {
}
