package com.parallaxcrm.salesteam;

import com.parallaxcrm.identity.DirectoryEntry;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * A sales rep as the sales team sees them: identity, profile, and live figures computed from the records they own.
 * YTD sales and attainment are always derived, never stored.
 */
public record SalesRep(
        DirectoryEntry user,
        String title,
        String department,
        String phone,
        String territory,
        BigDecimal quota,
        long profileVersion,
        long openLeadCount,
        long accountCount,
        long openOpportunityCount,
        BigDecimal openPipeline,
        BigDecimal weightedPipeline,
        BigDecimal ytdSales) {

    /** YTD sales as a percentage of quota, or null when no quota is set. */
    public BigDecimal attainmentPercent() {
        if (quota == null || quota.signum() == 0) {
            return null;
        }
        return ytdSales.multiply(BigDecimal.valueOf(100)).divide(quota, 1, RoundingMode.HALF_UP);
    }
}
