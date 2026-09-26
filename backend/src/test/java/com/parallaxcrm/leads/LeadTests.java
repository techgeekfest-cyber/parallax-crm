package com.parallaxcrm.leads;

import com.parallaxcrm.leads.internal.Lead;
import com.parallaxcrm.shared.error.InvalidRequestException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LeadTests {

    @Test
    void newLeadStartsAsNewWithNormalisedInput() {
        Lead lead = Lead.create("  Grace ", "Hopper", " Navy Labs ", " Grace.Hopper@Example.COM ",
                "   ", LeadSource.REFERRAL, new BigDecimal("12500.00"), null);

        assertThat(lead.getStatus()).isEqualTo(LeadStatus.NEW);
        assertThat(lead.getFirstName()).isEqualTo("Grace");
        assertThat(lead.getCompany()).isEqualTo("Navy Labs");
        assertThat(lead.getEmail()).isEqualTo("grace.hopper@example.com");
        assertThat(lead.getPhone()).isNull();
        assertThat(lead.fullName()).isEqualTo("Grace Hopper");
    }

    @Test
    void requiredFieldsAreEnforcedWithTheOffendingFieldName() {
        assertThatThrownBy(() -> Lead.create("Grace", " ", "Navy Labs", "g@example.com",
                null, null, null, null))
                .isInstanceOf(InvalidRequestException.class)
                .extracting("field").isEqualTo("lastName");
    }

    @Test
    void estimatedValueCannotBeNegative() {
        assertThatThrownBy(() -> Lead.create("Grace", "Hopper", "Navy Labs", "g@example.com",
                null, null, new BigDecimal("-1"), null))
                .isInstanceOf(InvalidRequestException.class)
                .extracting("field").isEqualTo("estimatedValue");
    }
}
