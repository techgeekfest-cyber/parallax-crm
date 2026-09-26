package com.parallaxcrm.leads;

import java.math.BigDecimal;

/** Input for creating a lead through {@link LeadService#create(NewLead)}. */
public record NewLead(
        String firstName,
        String lastName,
        String company,
        String email,
        String phone,
        LeadSource source,
        BigDecimal estimatedValue,
        String notes) {
}
