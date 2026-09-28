package com.parallaxcrm.analytics;

import com.parallaxcrm.opportunities.OpportunityStage;
import com.parallaxcrm.shared.web.UserRefResponse;
import org.jspecify.annotations.Nullable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Everything the dashboard shows, from one request. Each section is computed by aggregate SQL over the records the
 * viewer may see. A figure that can't be computed honestly (no closed deals, no quota) is null, never a misleading 0.
 *
 * <p>Which figures follow the selected period: {@code outcomes}, {@code trend}, the closed stages in {@code stages},
 * the "new" counts and the per-rep won/lost figures. Current-state figures ignore it: record totals, the open pipeline,
 * the forecast, and quota attainment (always calendar year to date).
 */
public record DashboardResponse(
        PeriodResponse period,
        ScopeResponse scope,
        RecordCountsResponse records,
        PipelineTotalsResponse pipeline,
        OutcomesResponse outcomes,
        QuotaResponse quota,
        List<StageBreakdownResponse> stages,
        List<TrendPointResponse> trend,
        ForecastResponse forecast,
        TeamPerformanceResponse team) {

    /** The selected period as whole UTC days, inclusive, and how the trend is bucketed. */
    public record PeriodResponse(AnalyticsRange range, LocalDate from, LocalDate to, AnalyticsRange.Bucket bucket) {
    }

    /** Whose figures these are: the whole organisation, or one owner (always the viewer, for a rep). */
    public record ScopeResponse(boolean organisation, @Nullable UserRefResponse owner) {
    }

    /** Active (non-archived) records in scope right now; {@code new*} were created during the period. */
    public record RecordCountsResponse(long leads, long openLeads, long newLeads, long accounts, long contacts,
            long opportunities, long newOpportunities) {
    }

    /** Open deals right now: total value and weighted value (Σ amount × probability). */
    public record PipelineTotalsResponse(long openCount, BigDecimal openAmount, BigDecimal weightedAmount) {
    }

    /**
     * Deals closed during the period. Win rate = won ÷ (won + lost), null with no closed deals. Average deal size = mean
     * amount of the deals won in the period, null with none won.
     */
    public record OutcomesResponse(long wonCount, BigDecimal wonAmount, long lostCount,
            @Nullable BigDecimal winRatePercent, @Nullable BigDecimal averageDealSize) {
    }

    /**
     * Closed-won revenue this calendar year against the annual quota of the sales people in scope. {@code quota} and
     * {@code attainmentPercent} are null when no quota is set.
     */
    public record QuotaResponse(int year, BigDecimal ytdSales, @Nullable BigDecimal quota,
            @Nullable BigDecimal attainmentPercent) {
    }

    /**
     * One pipeline stage. Open stages: every open deal now, and {@code sharePercent} = its share of open pipeline
     * value. Closed stages: deals closed during the period, and {@code sharePercent} = its share of those closed deals
     * by count. Null when there is nothing to share.
     */
    public record StageBreakdownResponse(OpportunityStage stage, long count, BigDecimal amount,
            BigDecimal weightedAmount, @Nullable BigDecimal sharePercent) {
    }

    /** Closed-won revenue in one week or month of the period ({@code periodStart} is the bucket's first day). */
    public record TrendPointResponse(LocalDate periodStart, long wonCount, BigDecimal wonAmount) {
    }

    /** Open pipeline by expected close month: this month and the next five, plus what is overdue or further out. */
    public record ForecastResponse(List<ForecastMonthResponse> months, long overdueCount, BigDecimal overdueAmount,
            long laterCount, BigDecimal laterAmount) {
    }

    public record ForecastMonthResponse(LocalDate month, long count, BigDecimal amount, BigDecimal weightedAmount) {
    }

    /** Sales people in scope, best year-to-date first. {@code total} counts all of them; {@code rows} is capped. */
    public record TeamPerformanceResponse(long total, List<RepPerformanceResponse> rows) {
    }

    public record RepPerformanceResponse(
            UserRefResponse rep,
            String role,
            @Nullable String territory,
            @Nullable BigDecimal quota,
            BigDecimal ytdSales,
            @Nullable BigDecimal attainmentPercent,
            long wonCount,
            BigDecimal wonAmount,
            long lostCount,
            @Nullable BigDecimal winRatePercent,
            long openCount,
            BigDecimal openAmount,
            BigDecimal weightedAmount) {
    }
}
