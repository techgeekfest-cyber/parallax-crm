package com.parallaxcrm.salesteam.web;

import com.parallaxcrm.salesteam.SalesTeamService.ProfileInput;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record SalesProfileRequest(
        @Size(max = 120) String title,
        @Size(max = 120) String department,
        @Size(max = 40) String phone,
        @Size(max = 120) String territory,
        @NotNull @PositiveOrZero @Digits(integer = 13, fraction = 2) BigDecimal quota,
        @Schema(description = "profileVersion from the loaded rep (0 if they have no profile yet).")
        @NotNull Long version) {

    ProfileInput toInput() {
        return new ProfileInput(title, department, phone, territory, quota);
    }
}
