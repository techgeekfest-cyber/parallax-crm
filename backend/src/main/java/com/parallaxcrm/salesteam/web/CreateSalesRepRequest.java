package com.parallaxcrm.salesteam.web;

import com.parallaxcrm.identity.Role;
import com.parallaxcrm.salesteam.SalesTeamService.ProfileInput;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/** Creates the rep's sign-in account and sales profile together (admins only). */
public record CreateSalesRepRequest(
        @NotBlank @Email @Size(max = 320) String email,
        @NotBlank @Size(max = 100) String firstName,
        @NotBlank @Size(max = 100) String lastName,
        @Schema(description = "SALES_REP or SALES_MANAGER") @NotNull Role role,
        @NotBlank @Size(min = 12, max = 72) String password,
        @Size(max = 120) String title,
        @Size(max = 120) String department,
        @Size(max = 40) String phone,
        @Size(max = 120) String territory,
        @PositiveOrZero @Digits(integer = 13, fraction = 2) BigDecimal quota) {

    ProfileInput profile() {
        return new ProfileInput(title, department, phone, territory, quota);
    }
}
