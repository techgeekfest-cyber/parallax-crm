package com.parallaxcrm.opportunities.web;

import com.parallaxcrm.accounts.AccountRefResponse;
import com.parallaxcrm.opportunities.OpportunityStage;
import com.parallaxcrm.opportunities.OpportunityType;
import com.parallaxcrm.shared.domain.LeadSource;
import com.parallaxcrm.shared.web.RecordPermissions;
import com.parallaxcrm.shared.web.UserRefResponse;
import org.jspecify.annotations.Nullable;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record OpportunityResponse(
        UUID id,
        String number,
        String name,
        AccountRefResponse account,
        BigDecimal amount,
        OpportunityStage stage,
        int probability,
        BigDecimal weightedAmount,
        LocalDate closeDate,
        @Nullable OpportunityType type,
        @Nullable LeadSource leadSource,
        @Nullable String description,
        @Nullable String nextStep,
        @Nullable UserRefResponse owner,
        @Nullable Instant closedAt,
        List<StageHistoryResponse> stageHistory,
        boolean archived,
        @Nullable Instant archivedAt,
        Instant createdAt,
        Instant updatedAt,
        long version,
        RecordPermissions permissions) {
}
