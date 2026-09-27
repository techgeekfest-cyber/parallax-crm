package com.parallaxcrm.accounts;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** Small and medium business attributes. */
public record SmbProfile(
        @Nullable @Size(max = 100) String businessType,
        @Nullable @PositiveOrZero @Max(500) Integer yearsInBusiness,
        @Nullable @Size(max = 200) String ownerName,
        @Nullable Boolean localBusiness) {
}
