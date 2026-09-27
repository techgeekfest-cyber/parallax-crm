package com.parallaxcrm.opportunities.web;

import com.parallaxcrm.opportunities.OpportunityStage;

import java.math.BigDecimal;
import java.util.List;

/** {@code count} and the amounts cover the whole stage; {@code opportunities} may be the first page of cards only. */
public record PipelineColumnResponse(OpportunityStage stage, long count, BigDecimal amount, BigDecimal weightedAmount,
        List<PipelineCardResponse> opportunities) {
}
