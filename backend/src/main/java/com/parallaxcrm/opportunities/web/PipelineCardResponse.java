package com.parallaxcrm.opportunities.web;

import com.parallaxcrm.accounts.AccountRefResponse;
import com.parallaxcrm.opportunities.OpportunityStage;
import com.parallaxcrm.shared.web.UserRefResponse;
import org.jspecify.annotations.Nullable;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** One card on the Kanban board. {@code allowedStages} is where the viewer may drag it (empty: read-only). */
public record PipelineCardResponse(
        UUID id,
        String number,
        String name,
        AccountRefResponse account,
        BigDecimal amount,
        OpportunityStage stage,
        int probability,
        LocalDate closeDate,
        @Nullable Instant closedAt,
        @Nullable String nextStep,
        @Nullable UserRefResponse owner,
        long version,
        List<OpportunityStage> allowedStages) {
}
