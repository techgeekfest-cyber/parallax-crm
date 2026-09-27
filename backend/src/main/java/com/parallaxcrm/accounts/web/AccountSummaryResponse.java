package com.parallaxcrm.accounts.web;

import com.parallaxcrm.accounts.AccountTier;
import com.parallaxcrm.accounts.AccountType;
import com.parallaxcrm.accounts.internal.Account;
import com.parallaxcrm.identity.UserSummary;
import com.parallaxcrm.shared.web.UserRefResponse;
import org.jspecify.annotations.Nullable;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Row shape for account tables and pickers. */
public record AccountSummaryResponse(
        UUID id,
        String number,
        String name,
        AccountType type,
        AccountTier tier,
        @Nullable String industry,
        @Nullable String website,
        @Nullable Integer employeeCount,
        @Nullable BigDecimal annualRevenue,
        @Nullable UserRefResponse owner,
        boolean archived,
        Instant createdAt) {

    static AccountSummaryResponse from(Account account, UserSummary owner) {
        return new AccountSummaryResponse(account.getId(), account.getNumber(), account.getName(), account.type(),
                account.tier(), account.getIndustry(), account.getWebsite(), account.getEmployeeCount(),
                account.getAnnualRevenue(), UserSummary.ref(owner), account.isArchived(), account.getCreatedAt());
    }
}
