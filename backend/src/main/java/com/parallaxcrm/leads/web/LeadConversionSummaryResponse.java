package com.parallaxcrm.leads.web;

import org.jspecify.annotations.Nullable;

import java.time.Instant;

/** Where a converted lead went. */
public record LeadConversionSummaryResponse(
        Instant convertedAt,
        @Nullable ConvertedRecordResponse account,
        @Nullable ConvertedRecordResponse contact,
        @Nullable ConvertedRecordResponse opportunity) {
}
