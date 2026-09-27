package com.parallaxcrm.leads.web;

import com.parallaxcrm.leads.LeadStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

public record LeadStatusTransitionRequest(
        @NotNull @Schema(description = "NEW, CONTACTED, QUALIFIED or DISQUALIFIED. Leads become CONVERTED by conversion.")
        LeadStatus status,
        @NotNull @Schema(description = "The version you last loaded; a newer version on the server is a 409 CONFLICT.")
        Long version) {
}
