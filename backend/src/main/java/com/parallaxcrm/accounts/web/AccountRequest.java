package com.parallaxcrm.accounts.web;

import com.parallaxcrm.accounts.AccountInput;
import com.parallaxcrm.accounts.AccountType;
import com.parallaxcrm.accounts.EnterpriseProfile;
import com.parallaxcrm.accounts.SmbProfile;
import com.parallaxcrm.accounts.StartupProfile;
import com.parallaxcrm.shared.web.AddressDto;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Create or fully update an account. Send only the profile that matches {@code type}. On update, {@code version}
 * must be the version you loaded; {@code type} can't change.
 */
public record AccountRequest(
        @NotNull AccountType type,
        @NotBlank @Size(max = 200) String name,
        @Size(max = 255) String website,
        @Size(max = 40) String phone,
        @Size(max = 100) String industry,
        @PositiveOrZero Integer employeeCount,
        @PositiveOrZero @Digits(integer = 13, fraction = 2) BigDecimal annualRevenue,
        @Valid AddressDto billingAddress,
        @Valid AddressDto shippingAddress,
        @Schema(description = "Owner; defaults to you on create and is unchanged on update when omitted.")
        UUID ownerId,
        @Valid EnterpriseProfile enterprise,
        @Valid SmbProfile smb,
        @Valid StartupProfile startup,
        @Schema(description = "Required on update (optimistic locking).")
        Long version) {

    AccountInput toInput() {
        return new AccountInput(type, name, website, phone, industry, employeeCount, annualRevenue,
                AddressDto.toAddress(billingAddress), AddressDto.toAddress(shippingAddress), ownerId, enterprise, smb,
                startup);
    }
}
