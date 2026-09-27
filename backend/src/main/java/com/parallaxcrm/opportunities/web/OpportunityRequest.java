package com.parallaxcrm.opportunities.web;

import com.parallaxcrm.opportunities.OpportunityInput;
import com.parallaxcrm.opportunities.OpportunityStage;
import com.parallaxcrm.opportunities.OpportunityType;
import com.parallaxcrm.shared.domain.LeadSource;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record OpportunityRequest(
        @NotNull UUID accountId,
        @NotBlank @Size(max = 200) String name,
        @NotNull @PositiveOrZero @Digits(integer = 13, fraction = 2) BigDecimal amount,
        @Schema(description = "Starting stage on create (default PROSPECTING). On update it must be omitted or unchanged: "
                + "stages change only through POST /opportunities/{id}/stage-transitions.")
        OpportunityStage stage,
        @Schema(description = "0–100. Omit to use the stage's default. Closed stages are always 100 (won) or 0 (lost).")
        @Min(0) @Max(100) Integer probability,
        @NotNull LocalDate closeDate,
        OpportunityType type,
        LeadSource leadSource,
        @Size(max = 5000) String description,
        @Size(max = 255) String nextStep,
        @Schema(description = "Owner; defaults to you on create and is unchanged on update when omitted.")
        UUID ownerId,
        @Schema(description = "Required on update (optimistic locking).")
        Long version) {

    OpportunityInput toInput() {
        return new OpportunityInput(accountId, name, amount, stage, probability, closeDate, type, leadSource,
                description, nextStep, ownerId);
    }
}
