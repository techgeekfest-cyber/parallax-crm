package com.parallaxcrm.accounts;

import com.parallaxcrm.shared.domain.Address;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Everything needed to create or fully update an account. Exactly the profile matching {@code type} may be given;
 * the other two must be null.
 */
public record AccountInput(
        AccountType type,
        String name,
        String website,
        String phone,
        String industry,
        Integer employeeCount,
        BigDecimal annualRevenue,
        Address billingAddress,
        Address shippingAddress,
        /* null means "assign to me" on create, "unchanged" is not supported: updates are full replacements */
        UUID ownerId,
        EnterpriseProfile enterprise,
        SmbProfile smb,
        StartupProfile startup) {
}
