package com.parallaxcrm.leads.web;

import com.parallaxcrm.leads.LeadSource;
import com.parallaxcrm.leads.NewLead;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record CreateLeadRequest(
        @NotBlank @Size(max = 100) String firstName,
        @NotBlank @Size(max = 100) String lastName,
        @NotBlank @Size(max = 200) String company,
        @NotBlank @Email @Size(max = 320) String email,
        @Size(max = 40) String phone,
        LeadSource source,
        @PositiveOrZero @Digits(integer = 13, fraction = 2) BigDecimal estimatedValue,
        @Size(max = 5000) String notes,
        @Schema(description = "Owner; defaults to the signed-in user. Only managers and admins may assign to others.")
        UUID ownerId) {

    NewLead toNewLead() {
        return new NewLead(firstName, lastName, company, email, phone, source, estimatedValue, notes, ownerId);
    }
}
