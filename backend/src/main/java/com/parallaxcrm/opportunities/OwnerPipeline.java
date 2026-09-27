package com.parallaxcrm.opportunities;

import java.math.BigDecimal;

/** Per-owner pipeline figures for the sales team view. */
public record OwnerPipeline(long openCount, BigDecimal openAmount, BigDecimal weightedAmount, BigDecimal wonSince) {

    public static final OwnerPipeline EMPTY = new OwnerPipeline(0, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
}
