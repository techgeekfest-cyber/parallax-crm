package com.parallaxcrm.leads;

import com.parallaxcrm.accounts.AccountType;
import com.parallaxcrm.opportunities.OpportunityStage;
import com.parallaxcrm.opportunities.OpportunityType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Converting a qualified lead into an account, a contact at that account and an opportunity on it — all reviewed and
 * possibly edited by the user first. Either describe a new {@code account} or give an {@code existingAccountId}.
 */
public record LeadConversion(
        @NotNull @Schema(description = "The lead version you reviewed; a newer version on the server is a 409 CONFLICT.")
        Long version,
        @Schema(description = "Attach the contact and opportunity to this active account instead of creating one.")
        UUID existingAccountId,
        @Valid @Schema(description = "The new account. Required unless existingAccountId is given.")
        ConversionAccount account,
        @NotNull @Valid ConversionContact contact,
        @NotNull @Valid ConversionOpportunity opportunity,
        @Schema(description = "Owner of the new records; defaults to the lead's owner. Only managers and admins may choose someone else.")
        UUID ownerId) {

    public record ConversionAccount(
            @NotNull AccountType type,
            @NotBlank @Size(max = 200) String name,
            @Size(max = 255) String website,
            @Size(max = 40) String phone,
            @Size(max = 100) String industry) {
    }

    public record ConversionContact(
            @NotBlank @Size(max = 100) String firstName,
            @NotBlank @Size(max = 100) String lastName,
            @Email @Size(max = 320) String email,
            @Size(max = 40) String phone,
            @Size(max = 120) String title,
            @Schema(description = "Make the contact the account's primary contact (demotes the current one).")
            Boolean primary) {
    }

    public record ConversionOpportunity(
            @NotBlank @Size(max = 200) String name,
            @NotNull @PositiveOrZero @Digits(integer = 13, fraction = 2) BigDecimal amount,
            @NotNull LocalDate closeDate,
            @Schema(description = "An open stage; defaults to PROSPECTING.")
            OpportunityStage stage,
            OpportunityType type,
            @Size(max = 255) String nextStep,
            @Size(max = 5000) String description) {
    }
}
