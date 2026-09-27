package com.parallaxcrm.opportunities.web;

import com.parallaxcrm.opportunities.OpportunityStage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record StageTransitionRequest(
        @NotNull OpportunityStage toStage,
        @NotNull @Schema(description = "The version you last loaded; a newer version on the server is a 409 CONFLICT.")
        Long version,
        @Size(max = 2000) @Schema(description = "Optional context, e.g. why the deal was lost. Shown on the timeline.")
        String note) {
}
