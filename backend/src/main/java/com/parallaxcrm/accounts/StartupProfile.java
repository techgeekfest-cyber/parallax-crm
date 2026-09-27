package com.parallaxcrm.accounts;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

import java.math.BigDecimal;

/** Startup attributes. */
public record StartupProfile(
        @Nullable FundingRound fundingRound,
        @Nullable @PositiveOrZero @Digits(integer = 13, fraction = 2) BigDecimal totalFunding,
        @Nullable @Size(max = 50) String investorType,
        @Nullable @PositiveOrZero Integer monthsToProfitability,
        @Nullable GrowthStage growthStage) {
}
