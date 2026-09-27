package com.parallaxcrm.opportunities.internal;

import com.parallaxcrm.opportunities.OpportunityInput;
import com.parallaxcrm.opportunities.OpportunityStage;
import com.parallaxcrm.shared.error.ErrorCode;
import com.parallaxcrm.shared.error.InvalidRequestException;
import com.parallaxcrm.shared.error.WorkflowRuleException;
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
        opportunity.transitionTo(OpportunityStage.NEGOTIATION);

        assertThat(opportunity.getClosedAt()).isNull();
        assertThat(opportunity.getProbability()).isEqualTo(75);
    }

    @Test
    void aTransitionResetsTheProbabilityToTheNewStageDefault() {
        Opportunity opportunity = create(OpportunityStage.PROPOSAL, 65);
        opportunity.transitionTo(OpportunityStage.NEGOTIATION);

        assertThat(opportunity.getStage()).isEqualTo(OpportunityStage.NEGOTIATION);
        assertThat(opportunity.getProbability()).isEqualTo(75);
        assertThat(opportunity.getClosedAt()).isNull();

        opportunity.transitionTo(OpportunityStage.CLOSED_WON);
        assertThat(opportunity.getProbability()).isEqualTo(100);
        assertThat(opportunity.getClosedAt()).isNotNull();
    }

    @Test
    void skippingStagesIsNotAllowed() {
        Opportunity opportunity = create(OpportunityStage.PROSPECTING, null);

        assertThatThrownBy(() -> opportunity.transitionTo(OpportunityStage.PROPOSAL))
                .isInstanceOf(WorkflowRuleException.class)
                .extracting("code").isEqualTo(ErrorCode.INVALID_STATE_TRANSITION);
        assertThatThrownBy(() -> opportunity.transitionTo(OpportunityStage.CLOSED_WON))
                .hasMessageContaining("can't move to Closed won");
        assertThat(opportunity.getStage()).isEqualTo(OpportunityStage.PROSPECTING);
    }

    @Test
    void movingToTheCurrentStageIsRejected() {
        assertThatThrownBy(() -> create(OpportunityStage.PROPOSAL, null).transitionTo(OpportunityStage.PROPOSAL))
                .isInstanceOf(WorkflowRuleException.class)
                .hasMessageContaining("already in Proposal");
    }

    @Test
    void anEditCannotChangeTheStage() {
        Opportunity opportunity = create(OpportunityStage.PROSPECTING, null);

        assertThatThrownBy(() -> opportunity.update(input(OpportunityStage.NEGOTIATION, null), UUID.randomUUID()))
                .isInstanceOf(InvalidRequestException.class)
                .extracting("field").isEqualTo("stage");
        opportunity.update(input(null, 15), UUID.randomUUID());
        assertThat(opportunity.getStage()).isEqualTo(OpportunityStage.PROSPECTING);
        assertThat(opportunity.getProbability()).isEqualTo(15);
    }

    @Test
    void theStageWorkflowIsExplicit() {
        assertThat(OpportunityStage.PROSPECTING.allowedTransitions())
                .containsExactly(OpportunityStage.QUALIFICATION, OpportunityStage.CLOSED_LOST);
        assertThat(OpportunityStage.QUALIFICATION.allowedTransitions())
                .containsExactly(OpportunityStage.PROSPECTING, OpportunityStage.PROPOSAL, OpportunityStage.CLOSED_LOST);
        assertThat(OpportunityStage.PROPOSAL.allowedTransitions())
                .containsExactly(OpportunityStage.QUALIFICATION, OpportunityStage.NEGOTIATION, OpportunityStage.CLOSED_LOST);
        assertThat(OpportunityStage.NEGOTIATION.allowedTransitions())
                .containsExactly(OpportunityStage.PROPOSAL, OpportunityStage.CLOSED_WON, OpportunityStage.CLOSED_LOST);
        // Closed deals reopen into any open stage, and never flip straight between won and lost.
        for (OpportunityStage closed : new OpportunityStage[] {OpportunityStage.CLOSED_WON, OpportunityStage.CLOSED_LOST}) {
            assertThat(closed.allowedTransitions()).containsExactly(OpportunityStage.PROSPECTING,
                    OpportunityStage.QUALIFICATION, OpportunityStage.PROPOSAL, OpportunityStage.NEGOTIATION);
        }
    }

    @Test
    void stagesHaveReadableLabels() {
        assertThat(OpportunityStage.CLOSED_WON.label()).isEqualTo("Closed won");
        assertThat(OpportunityStage.PROSPECTING.label()).isEqualTo("Prospecting");
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
