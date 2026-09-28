/**
 * Analytics: the dashboard's live, read-only figures — record counts, pipeline, outcomes, win rate, quota attainment,
 * revenue trend, forecast and rep performance — computed by PostgreSQL aggregate queries at request time.
 *
 * <p>This module reads the other modules' tables with SQL rather than calling their services: every figure is a
 * {@code count}/{@code sum}/{@code avg} over many rows, and loading entities to add them up in Java would not scale.
 * It never writes. Visibility follows the same rule as the records themselves (ADR 0007): reps' figures cover only what
 * they own, and the owner scope is part of every query's {@code WHERE} clause, never a filter applied afterwards.
 */
@ApplicationModule(displayName = "Analytics")
package com.parallaxcrm.analytics;

import org.springframework.modulith.ApplicationModule;
