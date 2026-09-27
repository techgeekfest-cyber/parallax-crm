package com.parallaxcrm.leads.web;

import com.parallaxcrm.identity.UserSummary;
import com.parallaxcrm.shared.domain.LeadSource;
import com.parallaxcrm.leads.LeadStatus;
import com.parallaxcrm.leads.internal.Lead;
import org.jspecify.annotations.Nullable;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Row shape for lead tables — omits heavy fields such as notes. */
public record LeadSummaryResponse(
        UUID id,
        String number,
        String fullName,
        String company,
        String email,
        LeadStatus status,
        @Nullable LeadSource source,
        @Nullable BigDecimal estimatedValue,
        @Nullable OwnerResponse owner,
        Instant createdAt) {

    static LeadSummaryResponse from(Lead lead, UserSummary owner) {
        return new LeadSummaryResponse(lead.getId(), lead.getNumber(), lead.fullName(), lead.getCompany(),
                lead.getEmail(), lead.getStatus(), lead.getSource(), lead.getEstimatedValue(), OwnerResponse.from(owner),
                lead.getCreatedAt());
    }
}
