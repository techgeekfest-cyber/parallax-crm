package com.parallaxcrm.analytics.internal;

import com.parallaxcrm.analytics.AnalyticsRange;
import com.parallaxcrm.analytics.DashboardResponse.ForecastMonthResponse;
import com.parallaxcrm.analytics.DashboardResponse.ForecastResponse;
import com.parallaxcrm.analytics.DashboardResponse.OutcomesResponse;
import com.parallaxcrm.analytics.DashboardResponse.PipelineTotalsResponse;
import com.parallaxcrm.analytics.DashboardResponse.RecordCountsResponse;
import com.parallaxcrm.analytics.DashboardResponse.RepPerformanceResponse;
import com.parallaxcrm.analytics.DashboardResponse.StageBreakdownResponse;
import com.parallaxcrm.analytics.DashboardResponse.TeamPerformanceResponse;
import com.parallaxcrm.analytics.DashboardResponse.TrendPointResponse;
import com.parallaxcrm.opportunities.OpportunityStage;
import com.parallaxcrm.shared.web.UserRefResponse;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The dashboard's aggregate SQL. Every query returns a handful of rows however many records exist, and every query
 * applies the owner scope in its WHERE clause ({@code :ownerId} null = the whole organisation).
 *
 * <p>Conventions shared by all queries: archived records are excluded; weighted value is
 * {@code amount × probability / 100}; "closed during the period" means {@code closed_at} in {@code [from, to)}; time
 * buckets are computed in UTC.
 */
@Component
public class AnalyticsQueries {

    private static final String OWNER = "(cast(:ownerId as uuid) is null or %s = cast(:ownerId as uuid))";
    private static final String OPEN = "stage in ('PROSPECTING', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION')";
    private static final String CLOSED = "stage in ('CLOSED_WON', 'CLOSED_LOST')";
    private static final String CLOSED_IN_PERIOD = CLOSED + " and closed_at >= :from and closed_at < :to";

    private final NamedParameterJdbcTemplate jdbc;

    AnalyticsQueries(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Every parameter the queries use: the owner scope, the period, "today" for the forecast and the start of the
     * calendar year for year-to-date figures.
     */
    public static MapSqlParameterSource parameters(UUID ownerId, AnalyticsRange.Window window, LocalDate today,
            Instant yearStart, int teamLimit) {
        LocalDate firstMonth = today.withDayOfMonth(1);
        return new MapSqlParameterSource()
                .addValue("ownerId", ownerId, Types.OTHER)
                .addValue("from", utc(window.from()), Types.TIMESTAMP_WITH_TIMEZONE)
                .addValue("to", utc(window.to()), Types.TIMESTAMP_WITH_TIMEZONE)
                .addValue("firstBucket", window.firstBucket(), Types.DATE)
                .addValue("lastBucket", window.lastBucket(), Types.DATE)
                .addValue("bucket", window.bucket() == AnalyticsRange.Bucket.WEEK ? "week" : "month")
                .addValue("step", window.bucket() == AnalyticsRange.Bucket.WEEK ? "1 week" : "1 month")
                .addValue("today", today, Types.DATE)
                .addValue("firstMonth", firstMonth, Types.DATE)
                .addValue("horizon", firstMonth.plusMonths(6), Types.DATE)
                .addValue("yearStart", utc(yearStart), Types.TIMESTAMP_WITH_TIMEZONE)
                .addValue("limit", teamLimit);
    }

    public RecordCountsResponse recordCounts(MapSqlParameterSource params) {
        String sql = """
                select
                  (select count(*) from leads where archived_at is null and %1$s) as leads,
                  (select count(*) from leads where archived_at is null and %1$s
                     and status in ('NEW', 'CONTACTED', 'QUALIFIED')) as open_leads,
                  (select count(*) from leads where archived_at is null and %1$s
                     and created_at >= :from and created_at < :to) as new_leads,
                  (select count(*) from accounts where archived_at is null and %1$s) as accounts,
                  (select count(*) from contacts where archived_at is null and %1$s) as contacts,
                  (select count(*) from opportunities where archived_at is null and %1$s) as opportunities,
                  (select count(*) from opportunities where archived_at is null and %1$s
                     and created_at >= :from and created_at < :to) as new_opportunities
                """.formatted(OWNER.formatted("owner_id"));
        return jdbc.queryForObject(sql, params, (rs, row) -> new RecordCountsResponse(rs.getLong("leads"),
                rs.getLong("open_leads"), rs.getLong("new_leads"), rs.getLong("accounts"), rs.getLong("contacts"),
                rs.getLong("opportunities"), rs.getLong("new_opportunities")));
    }

    public PipelineTotalsResponse openPipeline(MapSqlParameterSource params) {
        String sql = """
                select count(*) as open_count, coalesce(sum(amount), 0) as open_amount,
                       round(coalesce(sum(amount * probability / 100.0), 0), 2) as weighted_amount
                from opportunities
                where archived_at is null and %s and %s
                """.formatted(OPEN, OWNER.formatted("owner_id"));
        return jdbc.queryForObject(sql, params, (rs, row) -> new PipelineTotalsResponse(rs.getLong("open_count"),
                rs.getBigDecimal("open_amount"), rs.getBigDecimal("weighted_amount")));
    }

    public OutcomesResponse outcomes(MapSqlParameterSource params) {
        String sql = """
                select count(*) filter (where stage = 'CLOSED_WON') as won_count,
                       coalesce(sum(amount) filter (where stage = 'CLOSED_WON'), 0) as won_amount,
                       count(*) filter (where stage = 'CLOSED_LOST') as lost_count,
                       round(100.0 * count(*) filter (where stage = 'CLOSED_WON') / nullif(count(*), 0), 1) as win_rate,
                       round(avg(amount) filter (where stage = 'CLOSED_WON'), 2) as average_deal_size
                from opportunities
                where archived_at is null and %s and %s
                """.formatted(CLOSED_IN_PERIOD, OWNER.formatted("owner_id"));
        return jdbc.queryForObject(sql, params, (rs, row) -> new OutcomesResponse(rs.getLong("won_count"),
                rs.getBigDecimal("won_amount"), rs.getLong("lost_count"), rs.getBigDecimal("win_rate"),
                rs.getBigDecimal("average_deal_size")));
    }

    /** All six stages in pipeline order, present even when empty. */
    public List<StageBreakdownResponse> stages(MapSqlParameterSource params) {
        String sql = """
                with scoped as (
                    select stage, amount, probability from opportunities
                    where archived_at is null and %s and (%s or (%s))
                ), by_stage as (
                    select stage, count(*) as count, sum(amount) as amount,
                           round(sum(amount * probability / 100.0), 2) as weighted
                    from scoped group by stage
                )
                select stage, count, amount, weighted,
                       case when stage in ('CLOSED_WON', 'CLOSED_LOST')
                            then round(100.0 * count / nullif(sum(count) filter (where stage in ('CLOSED_WON', 'CLOSED_LOST')) over (), 0), 1)
                            else round(100.0 * amount / nullif(sum(amount) filter (where stage not in ('CLOSED_WON', 'CLOSED_LOST')) over (), 0), 1)
                       end as share
                from by_stage
                """.formatted(OWNER.formatted("owner_id"), OPEN, CLOSED_IN_PERIOD);
        Map<OpportunityStage, StageBreakdownResponse> found = new EnumMap<>(OpportunityStage.class);
        jdbc.query(sql, params, rs -> {
            OpportunityStage stage = OpportunityStage.valueOf(rs.getString("stage"));
            found.put(stage, new StageBreakdownResponse(stage, rs.getLong("count"), rs.getBigDecimal("amount"),
                    rs.getBigDecimal("weighted"), rs.getBigDecimal("share")));
        });
        List<StageBreakdownResponse> stages = new ArrayList<>();
        for (OpportunityStage stage : OpportunityStage.values()) {
            stages.add(found.getOrDefault(stage,
                    new StageBreakdownResponse(stage, 0, BigDecimal.ZERO, BigDecimal.ZERO, null)));
        }
        return stages;
    }

    /** Closed-won revenue per week or month of the period, one row per bucket (empty buckets included). */
    public List<TrendPointResponse> wonTrend(MapSqlParameterSource params) {
        String sql = """
                with buckets as (
                    select cast(generate_series(cast(:firstBucket as date), cast(:lastBucket as date),
                                                cast(:step as interval)) as date) as bucket
                )
                select b.bucket, count(o.id) as won_count, coalesce(sum(o.amount), 0) as won_amount
                from buckets b
                left join opportunities o
                  on o.archived_at is null and o.stage = 'CLOSED_WON'
                 and o.closed_at >= :from and o.closed_at < :to and %s
                 and cast(date_trunc(cast(:bucket as text), o.closed_at at time zone 'UTC') as date) = b.bucket
                group by b.bucket
                order by b.bucket
                """.formatted(OWNER.formatted("o.owner_id"));
        return jdbc.query(sql, params, (rs, row) -> new TrendPointResponse(rs.getObject("bucket", LocalDate.class),
                rs.getLong("won_count"), rs.getBigDecimal("won_amount")));
    }

    /**
     * Open deals by expected close month for this month and the next five; earlier close dates are overdue, later
     * ones are counted together.
     */
    public ForecastResponse forecast(MapSqlParameterSource params) {
        String months = """
                with months as (
                    select cast(generate_series(cast(:firstMonth as date), cast(:horizon as date) - interval '1 month',
                                                interval '1 month') as date) as month
                )
                select m.month, count(o.id) as count, coalesce(sum(o.amount), 0) as amount,
                       round(coalesce(sum(o.amount * o.probability / 100.0), 0), 2) as weighted
                from months m
                left join opportunities o
                  on o.archived_at is null and o.%s and %s
                 and o.close_date >= greatest(m.month, cast(:today as date))
                 and o.close_date < cast(m.month + interval '1 month' as date)
                group by m.month
                order by m.month
                """.formatted(OPEN, OWNER.formatted("o.owner_id"));
        List<ForecastMonthResponse> rows = jdbc.query(months, params, (rs, row) -> new ForecastMonthResponse(
                rs.getObject("month", LocalDate.class), rs.getLong("count"), rs.getBigDecimal("amount"),
                rs.getBigDecimal("weighted")));
        String edges = """
                select count(*) filter (where close_date < :today) as overdue_count,
                       coalesce(sum(amount) filter (where close_date < :today), 0) as overdue_amount,
                       count(*) filter (where close_date >= :horizon) as later_count,
                       coalesce(sum(amount) filter (where close_date >= :horizon), 0) as later_amount
                from opportunities
                where archived_at is null and %s and %s
                """.formatted(OPEN, OWNER.formatted("owner_id"));
        return jdbc.queryForObject(edges, params, (rs, row) -> new ForecastResponse(rows,
                rs.getLong("overdue_count"), rs.getBigDecimal("overdue_amount"), rs.getLong("later_count"),
                rs.getBigDecimal("later_amount")));
    }

    /** Closed-won revenue since the start of the calendar year and the summed annual quota of the sales people in scope. */
    public QuotaFigures quota(MapSqlParameterSource params) {
        String sql = """
                select
                  (select coalesce(sum(amount), 0) from opportunities
                    where archived_at is null and stage = 'CLOSED_WON' and closed_at >= :yearStart and %s) as ytd_sales,
                  (select coalesce(sum(r.quota), 0) from sales_reps r join users u on u.id = r.user_id
                    where u.active and u.role in ('SALES_REP', 'SALES_MANAGER') and %s) as quota
                """.formatted(OWNER.formatted("owner_id"), OWNER.formatted("r.user_id"));
        return jdbc.queryForObject(sql, params, (rs, row) -> new QuotaFigures(rs.getBigDecimal("ytd_sales"),
                rs.getBigDecimal("quota")));
    }

    public record QuotaFigures(BigDecimal ytdSales, BigDecimal quota) {
    }

    /**
     * One row per active sales person in scope, from a single grouped query (no per-rep queries). Year-to-date sales
     * and attainment use the calendar year; won/lost and win rate use the period.
     */
    public TeamPerformanceResponse team(MapSqlParameterSource params) {
        String sql = """
                with per_rep as (
                    select u.id, u.first_name, u.last_name, u.active, u.role, r.territory, r.quota,
                           coalesce(sum(o.amount) filter (where o.stage = 'CLOSED_WON' and o.closed_at >= :yearStart), 0) as ytd_sales,
                           count(o.id) filter (where o.stage = 'CLOSED_WON' and o.closed_at >= :from and o.closed_at < :to) as won_count,
                           coalesce(sum(o.amount) filter (where o.stage = 'CLOSED_WON' and o.closed_at >= :from and o.closed_at < :to), 0) as won_amount,
                           count(o.id) filter (where o.stage = 'CLOSED_LOST' and o.closed_at >= :from and o.closed_at < :to) as lost_count,
                           count(o.id) filter (where o.%1$s) as open_count,
                           coalesce(sum(o.amount) filter (where o.%1$s), 0) as open_amount,
                           round(coalesce(sum(o.amount * o.probability / 100.0) filter (where o.%1$s), 0), 2) as weighted
                    from users u
                    left join sales_reps r on r.user_id = u.id
                    left join opportunities o on o.owner_id = u.id and o.archived_at is null
                    where u.active and u.role in ('SALES_REP', 'SALES_MANAGER') and %2$s
                    group by u.id, r.territory, r.quota
                )
                select *, count(*) over () as total,
                       case when quota > 0 then round(100.0 * ytd_sales / quota, 1) end as attainment,
                       round(100.0 * won_count / nullif(won_count + lost_count, 0), 1) as win_rate
                from per_rep
                order by ytd_sales desc, open_amount desc, last_name, first_name, id
                limit :limit
                """.formatted(OPEN, OWNER.formatted("u.id"));
        long[] total = {0};
        List<RepPerformanceResponse> rows = jdbc.query(sql, params, (rs, row) -> {
            total[0] = rs.getLong("total");
            return repRow(rs);
        });
        return new TeamPerformanceResponse(total[0], rows);
    }

    private static RepPerformanceResponse repRow(ResultSet rs) throws SQLException {
        BigDecimal quota = rs.getBigDecimal("quota");
        return new RepPerformanceResponse(
                new UserRefResponse(rs.getObject("id", UUID.class),
                        rs.getString("first_name") + " " + rs.getString("last_name"), rs.getBoolean("active")),
                rs.getString("role"), rs.getString("territory"),
                quota == null || quota.signum() == 0 ? null : quota,
                rs.getBigDecimal("ytd_sales"), rs.getBigDecimal("attainment"),
                rs.getLong("won_count"), rs.getBigDecimal("won_amount"), rs.getLong("lost_count"),
                rs.getBigDecimal("win_rate"), rs.getLong("open_count"), rs.getBigDecimal("open_amount"),
                rs.getBigDecimal("weighted"));
    }

    private static OffsetDateTime utc(Instant instant) {
        return instant.atOffset(ZoneOffset.UTC);
    }
}
