package com.parallaxcrm.opportunities.web;

import com.parallaxcrm.accounts.AccountRefResponse;
import com.parallaxcrm.opportunities.OpportunityStage;
import com.parallaxcrm.shared.web.UserRefResponse;
import org.jspecify.annotations.Nullable;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record OpportunitySummaryResponse(
        UUID id,
        String number,
        String name,
        AccountRefResponse account,
        BigDecimal amount,
        OpportunityStage stage,
        int probability,
        LocalDate closeDate,
        @Nullable UserRefResponse owner,
        boolean archived,
        Instant createdAt) {
}
