package com.parallaxcrm.accounts.internal;

import com.parallaxcrm.accounts.AccountInput;
import com.parallaxcrm.accounts.AccountTier;
import com.parallaxcrm.accounts.AccountType;
import com.parallaxcrm.accounts.EnterpriseProfile;
import com.parallaxcrm.accounts.FundingRound;
import com.parallaxcrm.accounts.SmbProfile;
import com.parallaxcrm.accounts.StartupProfile;
import com.parallaxcrm.accounts.SupportLevel;
import com.parallaxcrm.shared.error.InvalidRequestException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Each account subtype decides its own tier and support level from its own data. */
class AccountHierarchyTests {

    private static final UUID OWNER = UUID.randomUUID();

    @Test
    void createBuildsTheSubtypeMatchingTheType() {
        assertThat(Account.create(input(AccountType.ENTERPRISE, null, null, null, null), OWNER))
                .isInstanceOf(EnterpriseAccount.class);
        assertThat(Account.create(input(AccountType.SMB, null, null, null, null), OWNER)).isInstanceOf(SmbAccount.class);
        assertThat(Account.create(input(AccountType.STARTUP, null, null, null, null), OWNER))
                .isInstanceOf(StartupAccount.class);
    }

    @ParameterizedTest(name = "revenue {0}, global employees {1} → {2}")
    @CsvSource({
            ",           ,       MAJOR",
            "999999999,  9999,   MAJOR",
            "1000000000, ,       STRATEGIC",
            ",           10000,  STRATEGIC"})
    void enterpriseTierFollowsScale(BigDecimal revenue, Integer globalEmployees, AccountTier expected) {
        Account account = Account.create(input(AccountType.ENTERPRISE, revenue,
                new EnterpriseProfile(null, globalEmployees, null, null, null), null, null), OWNER);
        assertThat(account.tier()).isEqualTo(expected);
    }

    @Test
    void enterpriseSupportDependsOnTheSupportContract() {
        Account withContract = Account.create(input(AccountType.ENTERPRISE, null,
                new EnterpriseProfile(null, null, null, null, true), null, null), OWNER);
        Account without = Account.create(input(AccountType.ENTERPRISE, null, null, null, null), OWNER);

        assertThat(withContract.supportLevel()).isEqualTo(SupportLevel.DEDICATED);
        assertThat(without.supportLevel()).isEqualTo(SupportLevel.PRIORITY);
    }

    @ParameterizedTest(name = "{0} years → {1}")
    @CsvSource({",EMERGING", "4,EMERGING", "5,ESTABLISHED", "30,ESTABLISHED"})
    void smbTierFollowsYearsInBusiness(Integer years, AccountTier expected) {
        Account account = Account.create(input(AccountType.SMB, null, null,
                new SmbProfile(null, years, null, null), null), OWNER);
        assertThat(account.tier()).isEqualTo(expected);
        assertThat(account.supportLevel()).isEqualTo(SupportLevel.STANDARD);
    }

    @ParameterizedTest(name = "{0} → {1}, {2} support")
    @CsvSource({
            "BOOTSTRAPPED, EARLY_STAGE,  STANDARD",
            "SEED,         EARLY_STAGE,  STANDARD",
            "SERIES_A,     GROWTH_STAGE, STANDARD",
            "SERIES_B,     GROWTH_STAGE, STANDARD",
            "SERIES_C,     LATE_STAGE,   PRIORITY",
            "SERIES_D_PLUS,LATE_STAGE,   PRIORITY"})
    void startupTierFollowsFunding(FundingRound round, AccountTier tier, SupportLevel support) {
        Account account = Account.create(input(AccountType.STARTUP, null, null, null,
                new StartupProfile(round, null, null, null, null)), OWNER);
        assertThat(account.tier()).isEqualTo(tier);
        assertThat(account.supportLevel()).isEqualTo(support);
    }

    @Test
    void theTypeCannotChangeAfterCreation() {
        Account account = Account.create(input(AccountType.SMB, null, null, null, null), OWNER);

        assertThatThrownBy(() -> account.update(input(AccountType.STARTUP, null, null, null, null), OWNER))
                .isInstanceOf(InvalidRequestException.class)
                .extracting("field").isEqualTo("type");
    }

    @Test
    void aProfileForAnotherTypeIsRejected() {
        assertThatThrownBy(() -> Account.create(input(AccountType.SMB, null,
                new EnterpriseProfile("E-1", null, null, null, null), null, null), OWNER))
                .isInstanceOf(InvalidRequestException.class)
                .extracting("field").isEqualTo("enterprise");
    }

    @Test
    void subsidiariesAreTrimmedAndDeduplicatedCaseInsensitively() {
        EnterpriseAccount account = (EnterpriseAccount) Account.create(input(AccountType.ENTERPRISE, null,
                new EnterpriseProfile(null, null, List.of(" Beta Ltd", "alpha GmbH", "BETA LTD", "  "), null, null),
                null, null), OWNER);

        assertThat(account.profile().subsidiaries()).containsExactly("alpha GmbH", "Beta Ltd");
    }

    @Test
    void negativeFiguresAreRejectedWithTheFieldName() {
        assertThatThrownBy(() -> Account.create(new AccountInput(AccountType.SMB, "Acme", null, null, null, -1, null,
                null, null, null, null, null, null), OWNER))
                .isInstanceOf(InvalidRequestException.class)
                .extracting("field").isEqualTo("employeeCount");
    }

    private static AccountInput input(AccountType type, BigDecimal revenue, EnterpriseProfile enterprise,
            SmbProfile smb, StartupProfile startup) {
        return new AccountInput(type, "Acme", null, null, null, null, revenue, null, null, null, enterprise, smb,
                startup);
    }
}
