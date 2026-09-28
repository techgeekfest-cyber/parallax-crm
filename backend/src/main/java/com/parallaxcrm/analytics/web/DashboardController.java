package com.parallaxcrm.analytics.web;

import com.parallaxcrm.analytics.AnalyticsRange;
import com.parallaxcrm.analytics.DashboardResponse;
import com.parallaxcrm.analytics.DashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/dashboard")
@Tag(name = "Analytics")
class DashboardController {

    private final DashboardService dashboard;

    DashboardController(DashboardService dashboard) {
        this.dashboard = dashboard;
    }

    @GetMapping
    @Operation(summary = "The dashboard",
            description = "Record counts, open and weighted pipeline, outcomes and win rate for the period, quota "
                    + "attainment, stage breakdown, won-revenue trend, close-date forecast and rep performance — all "
                    + "live SQL aggregates over what you can see. Reps always get their own figures.")
    DashboardResponse get(
            @Parameter(description = "Reporting period (default LAST_12_MONTHS)")
            @RequestParam(defaultValue = "LAST_12_MONTHS") AnalyticsRange range,
            @Parameter(description = "Only this owner's figures. Reps may only pass their own id.")
            @RequestParam(required = false) UUID ownerId) {
        return dashboard.dashboard(range, ownerId);
    }
}
