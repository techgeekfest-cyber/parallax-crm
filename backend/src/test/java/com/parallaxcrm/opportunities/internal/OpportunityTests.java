package com.parallaxcrm.opportunities.internal;

import com.parallaxcrm.opportunities.OpportunityInput;
import com.parallaxcrm.opportunities.OpportunityStage;
import com.parallaxcrm.shared.error.InvalidRequestException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OpportunityTests {

    @ParameterizedTest
    @EnumSource(OpportunityStage.class)
    void probabilityDefaultsFromTheStage(OpportunityStage stage) {
        assertThat(create(stage, null).getProbability()).isEqualTo(stage.defaultProbability());
    }

    @Test
    void openStagesAcceptAnExplicitProbability() {
        assertThat(create(OpportunityStage.PROPOSAL, 65).getProbability()).isEqualTo(65);
    }

    @Test
    void closedStagesForceTheirProbabilityAndStampTheCloseTime() {
        Opportunity won = create(OpportunityStage.CLOSED_WON, 40);
        Opportunity lost = create(OpportunityStage.CLOSED_LOST, 40);

        assertThat(won.getProbability()).isEqualTo(100);
        assertThat(lost.getProbability()).isZero();
        assertThat(won.getClosedAt()).isNotNull();
        assertThat(lost.getClosedAt()).isNotNull();
    }

    @Test
    void reopeningClearsTheCloseTime() {
        Opportunity opportunity = create(OpportunityStage.CLOSED_LOST, null);
        opportunity.update(input(OpportunityStage.NEGOTIATION, null), UUID.randomUUID());

        assertThat(opportunity.getClosedAt()).isNull();
        assertThat(opportunity.getProbability()).isEqualTo(75);
    }

    @Test
    void probabilityOutsideZeroToHundredIsRejected() {
        assertThatThrownBy(() -> create(OpportunityStage.PROSPECTING, 101))
                .isInstanceOf(InvalidRequestException.class)
                .extracting("field").isEqualTo("probability");
    }

    @Test
    void weightedAmountIsAmountTimesProbability() {
        assertThat(create(OpportunityStage.PROPOSAL, 30).weightedAmount()).isEqualByComparingTo("15000.00");
    }

    @Test
    void requiredFieldsAreEnforced() {
        assertThatThrownBy(() -> Opportunity.create(new OpportunityInput(UUID.randomUUID(), "Deal", BigDecimal.TEN,
                OpportunityStage.PROSPECTING, null, null, null, null, null, null, null), UUID.randomUUID()))
                .isInstanceOf(InvalidRequestException.class)
                .extracting("field").isEqualTo("closeDate");
        assertThatThrownBy(() -> Opportunity.create(new OpportunityInput(UUID.randomUUID(), "Deal",
                new BigDecimal("-1"), OpportunityStage.PROSPECTING, null, LocalDate.now(), null, null, null, null,
                null), UUID.randomUUID()))
                .isInstanceOf(InvalidRequestException.class)
                .extracting("field").isEqualTo("amount");
    }

    private static Opportunity create(OpportunityStage stage, Integer probability) {
        return Opportunity.create(input(stage, probability), UUID.randomUUID());
    }

    private static OpportunityInput input(OpportunityStage stage, Integer probability) {
        return new OpportunityInput(UUID.randomUUID(), "Platform rollout", new BigDecimal("50000"), stage, probability,
                LocalDate.now().plusMonths(2), null, null, null, null, null);
    }
}
