package com.parallaxcrm.analytics;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;

/**
 * The reporting periods the dashboard offers. Periods are whole UTC days ending today (inclusive), matching the
 * calendar-year-in-UTC convention the sales team figures already use. Short periods trend by week (ISO weeks, starting
 * Monday), longer ones by month.
 */
public enum AnalyticsRange {
    LAST_30_DAYS,
    LAST_90_DAYS,
    THIS_YEAR,
    LAST_12_MONTHS;

    public enum Bucket { WEEK, MONTH }

    /** A resolved period: {@code [from, to)} as instants, plus the trend buckets that cover it. */
    public record Window(AnalyticsRange range, LocalDate firstDay, LocalDate lastDay, Bucket bucket) {

        public Instant from() {
            return firstDay.atStartOfDay().toInstant(ZoneOffset.UTC);
        }

        /** Exclusive end: the start of the day after {@code lastDay}. */
        public Instant to() {
            return lastDay.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        }

        /** Start of the first trend bucket (may be before {@code firstDay}, e.g. the Monday of that week). */
        public LocalDate firstBucket() {
            return bucket == Bucket.WEEK
                    ? firstDay.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                    : firstDay.withDayOfMonth(1);
        }

        public LocalDate lastBucket() {
            return bucket == Bucket.WEEK
                    ? lastDay.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                    : lastDay.withDayOfMonth(1);
        }
    }

    public Window resolve(LocalDate today) {
        return switch (this) {
            case LAST_30_DAYS -> new Window(this, today.minusDays(29), today, Bucket.WEEK);
            case LAST_90_DAYS -> new Window(this, today.minusDays(89), today, Bucket.WEEK);
            case THIS_YEAR -> new Window(this, today.withDayOfYear(1), today, Bucket.MONTH);
            case LAST_12_MONTHS -> new Window(this, today.withDayOfMonth(1).minusMonths(11), today, Bucket.MONTH);
        };
    }
}
