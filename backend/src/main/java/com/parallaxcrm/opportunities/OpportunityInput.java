package com.parallaxcrm.opportunities;

import com.parallaxcrm.shared.domain.LeadSource;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Create or fully update an opportunity. {@code probability} null means "the stage's default"; closed stages always
 * use 100% (won) or 0% (lost). {@code ownerId} null means "me" on create and "unchanged" on update.
 */
public record OpportunityInput(
        UUID accountId,
        String name,
        BigDecimal amount,
        OpportunityStage stage,
        Integer probability,
        LocalDate closeDate,
        OpportunityType type,
        LeadSource leadSource,
        String description,
        String nextStep,
        UUID ownerId) {
}
