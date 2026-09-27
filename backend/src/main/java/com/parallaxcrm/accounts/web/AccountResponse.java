package com.parallaxcrm.accounts.web;

import com.parallaxcrm.accounts.AccountTier;
import com.parallaxcrm.accounts.AccountType;
import com.parallaxcrm.accounts.EnterpriseProfile;
import com.parallaxcrm.accounts.SmbProfile;
import com.parallaxcrm.accounts.StartupProfile;
import com.parallaxcrm.accounts.SupportLevel;
import com.parallaxcrm.accounts.internal.Account;
import com.parallaxcrm.accounts.internal.EnterpriseAccount;
import com.parallaxcrm.accounts.internal.SmbAccount;
import com.parallaxcrm.accounts.internal.StartupAccount;
import com.parallaxcrm.identity.UserSummary;
import com.parallaxcrm.shared.web.AddressDto;
import com.parallaxcrm.shared.web.UserRefResponse;
import com.parallaxcrm.shared.web.RecordPermissions;
import org.jspecify.annotations.Nullable;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/** Full account. Exactly one of {@code enterprise}, {@code smb}, {@code startup} is present, matching {@code type}. */
public record AccountResponse(
        UUID id,
        String number,
        AccountType type,
        AccountTier tier,
        SupportLevel supportLevel,
        String name,
        @Nullable String website,
        @Nullable String phone,
        @Nullable String industry,
        @Nullable Integer employeeCount,
        @Nullable BigDecimal annualRevenue,
        AddressDto billingAddress,
        AddressDto shippingAddress,
        @Nullable UserRefResponse owner,
        @Nullable EnterpriseProfile enterprise,
        @Nullable UserRefResponse accountManager,
        @Nullable SmbProfile smb,
        @Nullable StartupProfile startup,
        boolean archived,
        @Nullable Instant archivedAt,
        Instant createdAt,
        Instant updatedAt,
        long version,
        RecordPermissions permissions) {

    static AccountResponse from(Account account, Map<UUID, UserSummary> users, RecordPermissions permissions) {
        EnterpriseProfile enterprise = account instanceof EnterpriseAccount e ? e.profile() : null;
        return new AccountResponse(account.getId(), account.getNumber(), account.type(), account.tier(),
                account.supportLevel(), account.getName(), account.getWebsite(), account.getPhone(),
                account.getIndustry(), account.getEmployeeCount(), account.getAnnualRevenue(),
                AddressDto.from(account.getBillingAddress()), AddressDto.from(account.getShippingAddress()),
                UserSummary.ref(users.get(account.getOwnerId())), enterprise,
                enterprise == null ? null : UserSummary.ref(users.get(enterprise.accountManagerId())),
                account instanceof SmbAccount s ? s.profile() : null,
                account instanceof StartupAccount s ? s.profile() : null,
                account.isArchived(), account.getArchivedAt(), account.getCreatedAt(), account.getUpdatedAt(),
                account.getVersion(), permissions);
    }
}
