package com.parallaxcrm.accounts;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.UUID;

/** Enterprise-only attributes. */
public record EnterpriseProfile(
        @Nullable @Size(max = 50) String enterpriseId,
        @Nullable @PositiveOrZero Integer globalEmployeeCount,
        @Nullable @Size(max = 50) List<@NotBlank @Size(max = 200) String> subsidiaries,
        @Nullable UUID accountManagerId,
        @Nullable Boolean hasEnterpriseSupport) {
}
