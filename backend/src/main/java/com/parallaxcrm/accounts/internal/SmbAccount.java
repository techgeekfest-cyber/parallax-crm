package com.parallaxcrm.accounts.internal;

import com.parallaxcrm.accounts.AccountInput;
import com.parallaxcrm.accounts.AccountTier;
import com.parallaxcrm.accounts.AccountType;
import com.parallaxcrm.accounts.SmbProfile;
import com.parallaxcrm.accounts.SupportLevel;
import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import jakarta.persistence.PrimaryKeyJoinColumn;
import jakarta.persistence.Table;

import java.util.LinkedHashMap;
import java.util.Map;

@Entity
@Table(name = "smb_accounts")
@PrimaryKeyJoinColumn(name = "account_id")
@DiscriminatorValue("SMB")
public class SmbAccount extends Account {

    /** Years of trading after which a small business counts as established. */
    static final int ESTABLISHED_AFTER_YEARS = 5;

    @Column(name = "business_type")
    private String businessType;

    @Column(name = "years_in_business")
    private Integer yearsInBusiness;

    @Column(name = "owner_name")
    private String ownerName;

    @Column(name = "is_local_business", nullable = false)
    private boolean localBusiness;

    protected SmbAccount() {
        // for JPA and Account.create
    }

    @Override
    public AccountType type() {
        return AccountType.SMB;
    }

    @Override
    public AccountTier tier() {
        return yearsInBusiness != null && yearsInBusiness >= ESTABLISHED_AFTER_YEARS
                ? AccountTier.ESTABLISHED
                : AccountTier.EMERGING;
    }

    @Override
    public SupportLevel supportLevel() {
        return SupportLevel.STANDARD;
    }

    @Override
    protected void applyProfile(AccountInput input) {
        SmbProfile profile = input.smb() != null ? input.smb() : new SmbProfile(null, null, null, null);
        businessType = optional(profile.businessType());
        yearsInBusiness = nonNegative("smb.yearsInBusiness", profile.yearsInBusiness());
        ownerName = optional(profile.ownerName());
        localBusiness = Boolean.TRUE.equals(profile.localBusiness());
    }

    @Override
    protected Map<String, Object> profileSnapshot() {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("businessType", businessType);
        values.put("yearsInBusiness", yearsInBusiness);
        values.put("ownerName", ownerName);
        values.put("localBusiness", localBusiness);
        return values;
    }

    public SmbProfile profile() {
        return new SmbProfile(businessType, yearsInBusiness, ownerName, localBusiness);
    }
}
