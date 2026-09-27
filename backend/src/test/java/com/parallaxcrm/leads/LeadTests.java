package com.parallaxcrm.leads;

import com.parallaxcrm.shared.domain.LeadSource;
import com.parallaxcrm.leads.internal.Lead;
import com.parallaxcrm.shared.error.ErrorCode;
import com.parallaxcrm.shared.error.InvalidRequestException;
import com.parallaxcrm.shared.error.WorkflowRuleException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LeadTests {

    @Test
    void newLeadStartsAsNewWithNormalisedInput() {
        Lead lead = Lead.create("  Grace ", "Hopper", " Navy Labs ", " Grace.Hopper@Example.COM ",
                "   ", LeadSource.REFERRAL, new BigDecimal("12500.00"), null, null);

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
                null, null, null, null, null))
                .isInstanceOf(InvalidRequestException.class)
                .extracting("field").isEqualTo("lastName");
    }

    @Test
    void estimatedValueCannotBeNegative() {
        assertThatThrownBy(() -> Lead.create("Grace", "Hopper", "Navy Labs", "g@example.com",
                null, null, new BigDecimal("-1"), null, null))
                .isInstanceOf(InvalidRequestException.class)
                .extracting("field").isEqualTo("estimatedValue");
    }

    @Test
    void aLeadMovesBetweenWorkingStatusesButNeverToConvertedByHand() {
        Lead lead = newLead();
        lead.changeStatus(LeadStatus.CONTACTED);
        lead.changeStatus(LeadStatus.DISQUALIFIED);
        lead.changeStatus(LeadStatus.QUALIFIED);
        assertThat(lead.getStatus()).isEqualTo(LeadStatus.QUALIFIED);

        assertThatThrownBy(() -> lead.changeStatus(LeadStatus.CONVERTED))
                .isInstanceOf(WorkflowRuleException.class)
                .extracting("code").isEqualTo(ErrorCode.INVALID_STATE_TRANSITION);
        assertThatThrownBy(() -> lead.changeStatus(LeadStatus.QUALIFIED)).hasMessageContaining("already Qualified");
    }

    @Test
    void onlyQualifiedLeadsCanBeConverted() {
        Lead lead = newLead();
        assertThatThrownBy(lead::requireConvertible)
                .isInstanceOf(WorkflowRuleException.class)
                .hasMessageContaining("Only qualified leads");

        lead.changeStatus(LeadStatus.QUALIFIED);
        UUID account = UUID.randomUUID();
        UUID contact = UUID.randomUUID();
        UUID opportunity = UUID.randomUUID();
        lead.markConverted(account, contact, opportunity);

        assertThat(lead.getStatus()).isEqualTo(LeadStatus.CONVERTED);
        assertThat(lead.getConvertedAccountId()).isEqualTo(account);
        assertThat(lead.getConvertedContactId()).isEqualTo(contact);
        assertThat(lead.getConvertedOpportunityId()).isEqualTo(opportunity);
        assertThat(lead.getConvertedAt()).isNotNull();
    }

    @Test
    void aConvertedLeadIsFinal() {
        Lead lead = newLead();
        lead.changeStatus(LeadStatus.QUALIFIED);
        lead.markConverted(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());

        assertThatThrownBy(() -> lead.markConverted(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID()))
                .isInstanceOf(WorkflowRuleException.class)
                .extracting("code").isEqualTo(ErrorCode.ALREADY_CONVERTED);
        assertThatThrownBy(() -> lead.changeStatus(LeadStatus.NEW))
                .extracting("code").isEqualTo(ErrorCode.ALREADY_CONVERTED);
    }

    private static Lead newLead() {
        return Lead.create("Grace", "Hopper", "Navy Labs", "g@example.com", null, null, null, null, null);
    }
}
