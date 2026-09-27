package com.parallaxcrm.accounts.internal;

import com.parallaxcrm.accounts.AccountInput;
import com.parallaxcrm.accounts.AccountTier;
import com.parallaxcrm.accounts.AccountType;
import com.parallaxcrm.accounts.EnterpriseProfile;
import com.parallaxcrm.accounts.SupportLevel;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrimaryKeyJoinColumn;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

@Entity
@Table(name = "enterprise_accounts")
@PrimaryKeyJoinColumn(name = "account_id")
@DiscriminatorValue("ENTERPRISE")
public class EnterpriseAccount extends Account {

    /** Annual revenue from which an enterprise is treated as strategic. */
    static final BigDecimal STRATEGIC_REVENUE = new BigDecimal("1000000000");
    /** Worldwide headcount from which an enterprise is treated as strategic. */
    static final int STRATEGIC_GLOBAL_EMPLOYEES = 10_000;

    @Column(name = "enterprise_id")
    private String enterpriseId;

    @Column(name = "global_employee_count")
    private Integer globalEmployeeCount;

    @ElementCollection
    @CollectionTable(name = "enterprise_subsidiaries", joinColumns = @JoinColumn(name = "account_id"))
    @Column(name = "name", nullable = false)
    @OrderBy
    private List<String> subsidiaries = new ArrayList<>();

    @Column(name = "account_manager_id")
    private UUID accountManagerId;

    @Column(name = "has_enterprise_support", nullable = false)
    private boolean hasEnterpriseSupport;

    protected EnterpriseAccount() {
        // for JPA and Account.create
    }

    @Override
    public AccountType type() {
        return AccountType.ENTERPRISE;
    }

    @Override
    public AccountTier tier() {
        boolean largeRevenue = getAnnualRevenue() != null && getAnnualRevenue().compareTo(STRATEGIC_REVENUE) >= 0;
        boolean largeHeadcount = globalEmployeeCount != null && globalEmployeeCount >= STRATEGIC_GLOBAL_EMPLOYEES;
        return largeRevenue || largeHeadcount ? AccountTier.STRATEGIC : AccountTier.MAJOR;
    }

    @Override
    public SupportLevel supportLevel() {
        return hasEnterpriseSupport ? SupportLevel.DEDICATED : SupportLevel.PRIORITY;
    }

    @Override
    protected void applyProfile(AccountInput input) {
        EnterpriseProfile profile = input.enterprise() != null
                ? input.enterprise()
                : new EnterpriseProfile(null, null, null, null, null);
        enterpriseId = optional(profile.enterpriseId());
        globalEmployeeCount = nonNegative("enterprise.globalEmployeeCount", profile.globalEmployeeCount());
        accountManagerId = profile.accountManagerId();
        hasEnterpriseSupport = Boolean.TRUE.equals(profile.hasEnterpriseSupport());
        replaceSubsidiaries(profile.subsidiaries());
    }

    /** Names are trimmed and de-duplicated case-insensitively, matching the database's unique index. */
    private void replaceSubsidiaries(List<String> names) {
        Map<String, String> unique = new TreeMap<>();
        if (names != null) {
            for (String name : names) {
                String cleaned = optional(name);
                if (cleaned != null) {
                    unique.putIfAbsent(cleaned.toLowerCase(Locale.ROOT), cleaned);
                }
            }
        }
        List<String> next = List.copyOf(unique.values());
        if (!next.equals(subsidiaries)) {
            subsidiaries.clear();
            subsidiaries.addAll(next);
        }
    }

    @Override
    protected Map<String, Object> profileSnapshot() {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("enterpriseId", enterpriseId);
        values.put("globalEmployeeCount", globalEmployeeCount);
        values.put("subsidiaries", List.copyOf(subsidiaries));
        values.put("accountManagerId", accountManagerId);
        values.put("hasEnterpriseSupport", hasEnterpriseSupport);
        return values;
    }

    public EnterpriseProfile profile() {
        return new EnterpriseProfile(enterpriseId, globalEmployeeCount, List.copyOf(subsidiaries), accountManagerId,
                hasEnterpriseSupport);
    }

    public UUID getAccountManagerId() {
        return accountManagerId;
    }
}
