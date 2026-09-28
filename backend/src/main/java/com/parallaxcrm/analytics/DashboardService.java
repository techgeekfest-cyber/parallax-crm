package com.parallaxcrm.analytics;

import com.parallaxcrm.analytics.internal.AnalyticsQueries;
import com.parallaxcrm.identity.AccessPolicy;
import com.parallaxcrm.identity.AuthenticatedUser;
import com.parallaxcrm.identity.CurrentUser;
import com.parallaxcrm.identity.UserDirectory;
import com.parallaxcrm.identity.UserSummary;
import com.parallaxcrm.shared.error.PermissionDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

/**
 * Public API of the analytics module. Decides whose figures a request covers — reps only ever their own, managers and
 * admins the organisation or one chosen owner — and runs every aggregate with that scope inside the SQL.
 */
@Service
@Transactional(readOnly = true)
public class DashboardService {

    /** Rows in the rep table. The total is always reported, so a larger team is never silently cut. */
    static final int TEAM_LIMIT = 50;

    private final AnalyticsQueries queries;
    private final CurrentUser currentUser;
    private final AccessPolicy accessPolicy;
    private final UserDirectory users;
    private final Clock clock = Clock.systemUTC();

    DashboardService(AnalyticsQueries queries, CurrentUser currentUser, AccessPolicy accessPolicy, UserDirectory users) {
        this.queries = queries;
        this.currentUser = currentUser;
        this.accessPolicy = accessPolicy;
        this.users = users;
    }

    /**
     * @param requestedOwner optional: one owner's figures. Reps may only ask for themselves (anything else is refused,
     *                       not silently widened or narrowed), and without it they get their own figures.
     */
    public DashboardResponse dashboard(AnalyticsRange range, UUID requestedOwner) {
        AuthenticatedUser actor = currentUser.require();
        UUID ownerId = scope(actor, requestedOwner);
        LocalDate today = LocalDate.now(clock);
        AnalyticsRange.Window window = (range == null ? AnalyticsRange.LAST_12_MONTHS : range).resolve(today);
        Instant yearStart = today.withDayOfYear(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        var params = AnalyticsQueries.parameters(ownerId, window, today, yearStart, TEAM_LIMIT);

        var quota = queries.quota(params);
        BigDecimal annualQuota = quota.quota().signum() == 0 ? null : quota.quota();
        BigDecimal attainment = annualQuota == null ? null
                : quota.ytdSales().multiply(BigDecimal.valueOf(100)).divide(annualQuota, 1, RoundingMode.HALF_UP);

        UserSummary owner = ownerId == null ? null : users.summaries(List.of(ownerId)).get(ownerId);
        return new DashboardResponse(
                new DashboardResponse.PeriodResponse(window.range(), window.firstDay(), window.lastDay(), window.bucket()),
                new DashboardResponse.ScopeResponse(ownerId == null, UserSummary.ref(owner)),
                queries.recordCounts(params),
                queries.openPipeline(params),
                queries.outcomes(params),
                new DashboardResponse.QuotaResponse(today.getYear(), quota.ytdSales(), annualQuota, attainment),
                queries.stages(params),
                queries.wonTrend(params),
                queries.forecast(params),
                queries.team(params));
    }

    private UUID scope(AuthenticatedUser actor, UUID requestedOwner) {
        if (accessPolicy.canAccessAllSalesRecords(actor)) {
            return requestedOwner;
        }
        if (requestedOwner != null && !requestedOwner.equals(actor.id())) {
            throw new PermissionDeniedException("You can only view your own figures.");
        }
        return actor.id();
    }
}
