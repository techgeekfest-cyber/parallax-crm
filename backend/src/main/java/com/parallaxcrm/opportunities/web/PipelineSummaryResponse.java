package com.parallaxcrm.opportunities.web;

import com.parallaxcrm.opportunities.PipelineSummary;

import java.math.BigDecimal;

public record PipelineSummaryResponse(
        long openCount,
        BigDecimal openAmount,
        BigDecimal weightedAmount,
        long wonCount,
        BigDecimal wonAmount,
        long lostCount) {

    static PipelineSummaryResponse from(PipelineSummary summary) {
        return new PipelineSummaryResponse(summary.openCount(), summary.openAmount(), summary.weightedAmount(),
                summary.wonCount(), summary.wonAmount(), summary.lostCount());
    }
}
