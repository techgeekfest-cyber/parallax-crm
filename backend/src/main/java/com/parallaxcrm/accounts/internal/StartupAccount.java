package com.parallaxcrm.accounts.internal;

import com.parallaxcrm.accounts.AccountInput;
import com.parallaxcrm.accounts.AccountTier;
import com.parallaxcrm.accounts.AccountType;
import com.parallaxcrm.accounts.FundingRound;
import com.parallaxcrm.accounts.GrowthStage;
import com.parallaxcrm.accounts.StartupProfile;
import com.parallaxcrm.accounts.SupportLevel;
import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.PrimaryKeyJoinColumn;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

@Entity
@Table(name = "startup_accounts")
@PrimaryKeyJoinColumn(name = "account_id")
@DiscriminatorValue("STARTUP")
public class StartupAccount extends Account {

    @Enumerated(EnumType.STRING)
    @Column(name = "funding_round")
    private FundingRound fundingRound;

    @Column(name = "total_funding")
    private BigDecimal totalFunding;

    @Column(name = "investor_type")
    private String investorType;

    @Column(name = "months_to_profitability")
    private Integer monthsToProfitability;

    @Enumerated(EnumType.STRING)
    @Column(name = "growth_stage")
    private GrowthStage growthStage;

    protected StartupAccount() {
        // for JPA and Account.create
    }

    @Override
    public AccountType type() {
        return AccountType.STARTUP;
    }

    /** Startups are tiered by how far their funding has progressed. */
    @Override
    public AccountTier tier() {
        if (fundingRound == null) {
            return AccountTier.EARLY_STAGE;
        }
        return switch (fundingRound) {
            case BOOTSTRAPPED, PRE_SEED, SEED -> AccountTier.EARLY_STAGE;
            case SERIES_A, SERIES_B -> AccountTier.GROWTH_STAGE;
            case SERIES_C, SERIES_D_PLUS -> AccountTier.LATE_STAGE;
        };
    }

    /** Late-stage startups get priority support; earlier ones standard. */
    @Override
    public SupportLevel supportLevel() {
        return tier() == AccountTier.LATE_STAGE ? SupportLevel.PRIORITY : SupportLevel.STANDARD;
    }

    @Override
    protected void applyProfile(AccountInput input) {
        StartupProfile profile = input.startup() != null
                ? input.startup()
                : new StartupProfile(null, null, null, null, null);
        fundingRound = profile.fundingRound();
        totalFunding = nonNegative("startup.totalFunding", profile.totalFunding());
        investorType = optional(profile.investorType());
        monthsToProfitability = nonNegative("startup.monthsToProfitability", profile.monthsToProfitability());
        growthStage = profile.growthStage();
    }

    @Override
    protected Map<String, Object> profileSnapshot() {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("fundingRound", fundingRound);
        values.put("totalFunding", totalFunding);
        values.put("investorType", investorType);
        values.put("monthsToProfitability", monthsToProfitability);
        values.put("growthStage", growthStage);
        return values;
    }

    public StartupProfile profile() {
        return new StartupProfile(fundingRound, totalFunding, investorType, monthsToProfitability, growthStage);
    }
}
