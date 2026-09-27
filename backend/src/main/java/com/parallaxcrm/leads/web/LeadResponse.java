package com.parallaxcrm.leads.web;

import com.parallaxcrm.identity.UserSummary;
import com.parallaxcrm.shared.domain.LeadSource;
import com.parallaxcrm.leads.LeadStatus;
import com.parallaxcrm.leads.internal.Lead;
import org.jspecify.annotations.Nullable;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record LeadResponse(
        UUID id,
        String number,
        String firstName,
        String lastName,
        String fullName,
        String company,
        String email,
        @Nullable String phone,
        LeadStatus status,
        @Nullable LeadSource source,
        @Nullable BigDecimal estimatedValue,
        @Nullable String notes,
        @Nullable OwnerResponse owner,
        Instant createdAt,
        Instant updatedAt,
        long version) {

    static LeadResponse from(Lead lead, UserSummary owner) {
        return new LeadResponse(lead.getId(), lead.getNumber(), lead.getFirstName(), lead.getLastName(),
                lead.fullName(), lead.getCompany(), lead.getEmail(), lead.getPhone(), lead.getStatus(),
                lead.getSource(), lead.getEstimatedValue(), lead.getNotes(), OwnerResponse.from(owner), lead.getCreatedAt(),
                lead.getUpdatedAt(), lead.getVersion());
    }
}
