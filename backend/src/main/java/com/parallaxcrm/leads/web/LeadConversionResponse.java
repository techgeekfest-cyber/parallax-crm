package com.parallaxcrm.leads.web;

/** The records a lead became, for the success summary. */
public record LeadConversionResponse(
        LeadResponse lead,
        ConvertedRecordResponse account,
        /* false when the lead was attached to an existing account */
        boolean accountCreated,
        ConvertedRecordResponse contact,
        ConvertedRecordResponse opportunity) {
}
