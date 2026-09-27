package com.parallaxcrm.opportunities;

import java.math.BigDecimal;

/**
 * Totals over the opportunities the viewer can see. Weighted pipeline = sum of amount × probability for open deals.
 */
public record PipelineSummary(
        long openCount,
        BigDecimal openAmount,
        BigDecimal weightedAmount,
        long wonCount,
        BigDecimal wonAmount,
        long lostCount) {
}
