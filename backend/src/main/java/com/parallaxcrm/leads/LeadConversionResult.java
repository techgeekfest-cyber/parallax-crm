package com.parallaxcrm.leads;

import com.parallaxcrm.accounts.AccountSummary;
import com.parallaxcrm.contacts.ContactSummary;
import com.parallaxcrm.leads.internal.Lead;
import com.parallaxcrm.opportunities.OpportunitySummary;

/** What a conversion produced. {@code accountCreated} is false when the lead was attached to an existing account. */
public record LeadConversionResult(Lead lead, AccountSummary account, boolean accountCreated, ContactSummary contact,
        OpportunitySummary opportunity) {
}
