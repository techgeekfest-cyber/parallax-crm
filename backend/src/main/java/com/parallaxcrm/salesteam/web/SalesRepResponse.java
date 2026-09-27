package com.parallaxcrm.salesteam.web;

import com.parallaxcrm.identity.Role;
import com.parallaxcrm.salesteam.SalesRep;
import org.jspecify.annotations.Nullable;

import java.math.BigDecimal;
import java.util.UUID;

/** A sales rep with live performance figures. {@code id} is the user's id. */
public record SalesRepResponse(
        UUID id,
        String email,
        String firstName,
        String lastName,
        String fullName,
        Role role,
        boolean active,
        @Nullable String title,
        @Nullable String department,
        @Nullable String phone,
        @Nullable String territory,
        BigDecimal quota,
        BigDecimal ytdSales,
        @Nullable BigDecimal attainmentPercent,
        long openLeadCount,
        long accountCount,
        long openOpportunityCount,
        BigDecimal openPipeline,
        BigDecimal weightedPipeline,
        long profileVersion,
        boolean canEdit) {

    static SalesRepResponse from(SalesRep rep, boolean canEdit) {
        var user = rep.user();
        return new SalesRepResponse(user.id(), user.email(), user.firstName(), user.lastName(), user.fullName(),
                user.role(), user.active(), rep.title(), rep.department(), rep.phone(), rep.territory(), rep.quota(),
                rep.ytdSales(), rep.attainmentPercent(), rep.openLeadCount(), rep.accountCount(),
                rep.openOpportunityCount(), rep.openPipeline(), rep.weightedPipeline(), rep.profileVersion(), canEdit);
    }
}
