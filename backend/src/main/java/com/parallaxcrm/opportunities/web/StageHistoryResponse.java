package com.parallaxcrm.opportunities.web;

import com.parallaxcrm.opportunities.OpportunityStage;
import com.parallaxcrm.shared.web.UserRefResponse;
import org.jspecify.annotations.Nullable;

import java.math.BigDecimal;
import java.time.Instant;

public record StageHistoryResponse(
        @Nullable OpportunityStage fromStage,
        OpportunityStage toStage,
        BigDecimal amount,
        int probability,
        @Nullable UserRefResponse changedBy,
        Instant changedAt) {
}
