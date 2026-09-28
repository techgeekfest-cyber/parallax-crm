package com.parallaxcrm.analytics;

import com.parallaxcrm.IntegrationTest;
import com.parallaxcrm.identity.AuthenticatedUser;
import com.parallaxcrm.identity.Role;
import com.parallaxcrm.support.Api;
import com.parallaxcrm.support.TestDatabase;
import com.parallaxcrm.support.TestUsers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import tools.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The dashboard's figures over HTTP against real PostgreSQL, checked against values worked out by hand from a known
 * set of records. Every record is created through the API (closing dates in the past are then set with SQL, since
 * the API always closes "now").
 */
@IntegrationTest
class DashboardIntegrationTests {

    @Autowired
    Api api;

    @Autowired
    TestDatabase database;

    @Autowired
    TestUsers users;

    AuthenticatedUser admin;
    AuthenticatedUser manager;
    AuthenticatedUser repA;
    AuthenticatedUser repB;
    LocalDate today;

    @BeforeEach
    void setUp() {
        database.reset();
        admin = users.create(Role.ADMIN);
        manager = users.create(Role.SALES_MANAGER);
        repA = users.create(Role.SALES_REP);
        repB = users.create(Role.SALES_REP);
        today = LocalDate.now(ZoneOffset.UTC);
    }

    @Test
    void anEmptyDatabaseGivesZeroCountsAndNoMisleadingRates() {
        JsonNode body = dashboard(admin, "");

        assertThat(body.at("/records/leads").asLong()).isZero();
        assertThat(body.at("/records/opportunities").asLong()).isZero();
        assertThat(amount(body.at("/pipeline/openAmount"))).isZero();
        assertThat(amount(body.at("/pipeline/weightedAmount"))).isZero();
        // No closed deals: no win rate or average, rather than a false 0%.
        assertThat(body.at("/outcomes").has("winRatePercent")).isFalse();
        assertThat(body.at("/outcomes").has("averageDealSize")).isFalse();
        // No quota set anywhere: no attainment.
        assertThat(body.at("/quota").has("quota")).isFalse();
        assertThat(body.at("/quota").has("attainmentPercent")).isFalse();
        assertThat(body.at("/stages")).hasSize(6);
        assertThat(body.at("/stages").valueStream().map(s -> s.has("sharePercent"))).containsOnly(false);
        assertThat(body.at("/trend")).hasSize(12);
        assertThat(body.at("/trend").valueStream().map(p -> amount(p.get("wonAmount")))).allMatch(a -> a.signum() == 0);
        assertThat(body.at("/forecast/months")).hasSize(6);
        // Two reps and a manager exist, with no deals yet.
        assertThat(body.at("/team/total").asLong()).isEqualTo(3);
        assertThat(body.at("/scope/organisation").asBoolean()).isTrue();
    }

    @Test
    void organisationFiguresMatchTheRecords() {
        seed();

        JsonNode body = dashboard(manager, "");

        // Record counts: archived records never count.
        assertThat(body.at("/records/leads").asLong()).isEqualTo(3);
        assertThat(body.at("/records/openLeads").asLong()).isEqualTo(3);
        assertThat(body.at("/records/accounts").asLong()).isEqualTo(2);
        assertThat(body.at("/records/contacts").asLong()).isEqualTo(1);
        assertThat(body.at("/records/opportunities").asLong()).isEqualTo(7);

        // Open pipeline: 10,000 @10% + 40,000 @50% + 20,000 @75%.
        assertThat(body.at("/pipeline/openCount").asLong()).isEqualTo(3);
        assertThat(amount(body.at("/pipeline/openAmount"))).isEqualByComparingTo("70000");
        assertThat(amount(body.at("/pipeline/weightedAmount"))).isEqualByComparingTo("36000.00");

        // Closed in the last 12 months: won 30,000 + 50,000, lost 5,000. The deal won 800 days ago is outside.
        assertThat(body.at("/outcomes/wonCount").asLong()).isEqualTo(2);
        assertThat(amount(body.at("/outcomes/wonAmount"))).isEqualByComparingTo("80000");
        assertThat(body.at("/outcomes/lostCount").asLong()).isEqualTo(1);
        assertThat(amount(body.at("/outcomes/winRatePercent"))).isEqualByComparingTo("66.7");
        assertThat(amount(body.at("/outcomes/averageDealSize"))).isEqualByComparingTo("40000.00");

        // Quota: this year's won revenue against both reps' quotas (100,000 + 50,000).
        assertThat(amount(body.at("/quota/ytdSales"))).isEqualByComparingTo("80000");
        assertThat(amount(body.at("/quota/quota"))).isEqualByComparingTo("150000");
        assertThat(amount(body.at("/quota/attainmentPercent"))).isEqualByComparingTo("53.3");

        // Stages in pipeline order. Open stages share open value; closed stages share the period's closed deals.
        Map<String, JsonNode> stages = byStage(body);
        assertThat(stages.keySet()).containsExactly("PROSPECTING", "QUALIFICATION", "PROPOSAL", "NEGOTIATION",
                "CLOSED_WON", "CLOSED_LOST");
        assertStage(stages.get("PROSPECTING"), 1, "10000", "1000.00", "14.3");
        assertStage(stages.get("PROPOSAL"), 1, "40000", "20000.00", "57.1");
        assertStage(stages.get("NEGOTIATION"), 1, "20000", "15000.00", "28.6");
        assertStage(stages.get("CLOSED_WON"), 2, "80000", "80000.00", "66.7");
        assertStage(stages.get("CLOSED_LOST"), 1, "5000", "0.00", "33.3");
        assertThat(stages.get("QUALIFICATION").at("/count").asLong()).isZero();
        assertThat(stages.get("QUALIFICATION").has("sharePercent")).isFalse();

        // Trend: 12 months ending this month; this period's won revenue is all in the current month.
        JsonNode trend = body.at("/trend");
        assertThat(trend).hasSize(12);
        assertThat(trend.get(11).at("/periodStart").asString()).isEqualTo(today.withDayOfMonth(1).toString());
        assertThat(amount(trend.get(11).at("/wonAmount"))).isEqualByComparingTo("80000");
        assertThat(trend.get(11).at("/wonCount").asLong()).isEqualTo(2);
        assertThat(trend.valueStream().map(p -> amount(p.get("wonAmount"))).reduce(BigDecimal.ZERO, BigDecimal::add))
                .isEqualByComparingTo("80000");

        // Forecast by expected close month: one deal this month, one in two months' time, one overdue.
        JsonNode forecast = body.at("/forecast");
        assertThat(forecast.at("/months/0/month").asString()).isEqualTo(today.withDayOfMonth(1).toString());
        assertThat(amount(forecast.at("/months/0/amount"))).isEqualByComparingTo("10000");
        assertThat(amount(forecast.at("/months/2/amount"))).isEqualByComparingTo("40000");
        assertThat(amount(forecast.at("/months/2/weightedAmount"))).isEqualByComparingTo("20000.00");
        assertThat(forecast.at("/overdueCount").asLong()).isEqualTo(1);
        assertThat(amount(forecast.at("/overdueAmount"))).isEqualByComparingTo("20000");
        assertThat(forecast.at("/laterCount").asLong()).isZero();

        // Team: best year-to-date first; every active sales person, with their own figures.
        JsonNode team = body.at("/team");
        assertThat(team.at("/total").asLong()).isEqualTo(3);
        assertThat(team.at("/rows/0/rep/id").asString()).isEqualTo(repB.id().toString());
        assertThat(amount(team.at("/rows/0/ytdSales"))).isEqualByComparingTo("50000");
        assertThat(amount(team.at("/rows/0/attainmentPercent"))).isEqualByComparingTo("100.0");
        JsonNode a = team.at("/rows/1");
        assertThat(a.at("/rep/id").asString()).isEqualTo(repA.id().toString());
        assertThat(amount(a.at("/ytdSales"))).isEqualByComparingTo("30000");
        assertThat(amount(a.at("/quota"))).isEqualByComparingTo("100000");
        assertThat(amount(a.at("/attainmentPercent"))).isEqualByComparingTo("30.0");
        assertThat(a.at("/wonCount").asLong()).isEqualTo(1);
        assertThat(a.at("/lostCount").asLong()).isEqualTo(1);
        assertThat(amount(a.at("/winRatePercent"))).isEqualByComparingTo("50.0");
        assertThat(a.at("/openCount").asLong()).isEqualTo(2);
        assertThat(amount(a.at("/openAmount"))).isEqualByComparingTo("50000");
        assertThat(amount(a.at("/weightedAmount"))).isEqualByComparingTo("21000.00");
        JsonNode m = team.at("/rows/2");
        assertThat(m.at("/rep/id").asString()).isEqualTo(manager.id().toString());
        assertThat(m.has("quota")).isFalse();
        assertThat(m.has("attainmentPercent")).isFalse();
        assertThat(m.has("winRatePercent")).isFalse();
    }

    @Test
    void aRepOnlyEverGetsTheirOwnFigures() {
        seed();

        JsonNode body = dashboard(repA, "");

        assertThat(body.at("/scope/organisation").asBoolean()).isFalse();
        assertThat(body.at("/scope/owner/id").asString()).isEqualTo(repA.id().toString());
        assertThat(body.at("/records/leads").asLong()).isEqualTo(2);
        assertThat(body.at("/records/accounts").asLong()).isEqualTo(1);
        assertThat(body.at("/records/opportunities").asLong()).isEqualTo(4);
        assertThat(amount(body.at("/pipeline/openAmount"))).isEqualByComparingTo("50000");
        assertThat(amount(body.at("/pipeline/weightedAmount"))).isEqualByComparingTo("21000.00");
        assertThat(amount(body.at("/outcomes/wonAmount"))).isEqualByComparingTo("30000");
        assertThat(amount(body.at("/outcomes/winRatePercent"))).isEqualByComparingTo("50.0");
        assertThat(amount(body.at("/outcomes/averageDealSize"))).isEqualByComparingTo("30000.00");
        assertThat(amount(body.at("/quota/quota"))).isEqualByComparingTo("100000");
        assertThat(amount(body.at("/quota/attainmentPercent"))).isEqualByComparingTo("30.0");
        assertThat(body.at("/team/total").asLong()).isEqualTo(1);
        assertThat(body.at("/team/rows/0/rep/id").asString()).isEqualTo(repA.id().toString());
        assertThat(body.at("/forecast/overdueCount").asLong()).isZero(); // the overdue deal is repB's

        // Asking for someone else's figures is refused outright, not quietly answered with their own.
        assertThat(api.get(repA, "/api/v1/dashboard?ownerId={id}", repB.id())).hasStatus(HttpStatus.FORBIDDEN)
                .bodyJson().hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("PERMISSION_DENIED"));
        assertThat(api.get(repA, "/api/v1/dashboard?ownerId={id}", repA.id())).hasStatusOk();
    }

    @Test
    void managersAndAdminsCanFocusOnOneOwner() {
        seed();

        JsonNode body = dashboard(manager, "&ownerId=" + repB.id());

        assertThat(body.at("/scope/organisation").asBoolean()).isFalse();
        assertThat(body.at("/scope/owner/fullName").asString()).isEqualTo(repB.fullName());
        assertThat(amount(body.at("/pipeline/openAmount"))).isEqualByComparingTo("20000");
        assertThat(amount(body.at("/outcomes/wonAmount"))).isEqualByComparingTo("50000");
        assertThat(body.at("/outcomes").has("winRatePercent")).isTrue();
        assertThat(amount(body.at("/outcomes/winRatePercent"))).isEqualByComparingTo("100.0");
        assertThat(amount(body.at("/quota/attainmentPercent"))).isEqualByComparingTo("100.0");
        assertThat(body.at("/team/total").asLong()).isEqualTo(1);
        assertThat(dashboard(admin, "&ownerId=" + repB.id()).at("/records/opportunities").asLong()).isEqualTo(3);
    }

    @Test
    void thePeriodDecidesWhichClosedDealsCount() {
        String account = api.create(repA, "/api/v1/accounts", Map.of("name", "Period Co", "type", "SMB"));
        String recent = opportunity(repA, account, "Recent win", 1000, "CLOSED_WON", today.plusDays(5));
        String older = opportunity(repA, account, "Older win", 4000, "CLOSED_WON", today.plusDays(5));
        String oldLoss = opportunity(repA, account, "Older loss", 9000, "CLOSED_LOST", today.plusDays(5));
        closedDaysAgo(recent, 3);
        closedDaysAgo(older, 60);
        closedDaysAgo(oldLoss, 60);

        JsonNode month = dashboard(repA, "&range=LAST_30_DAYS");
        assertThat(month.at("/period/bucket").asString()).isEqualTo("WEEK");
        assertThat(month.at("/period/from").asString()).isEqualTo(today.minusDays(29).toString());
        assertThat(amount(month.at("/outcomes/wonAmount"))).isEqualByComparingTo("1000");
        assertThat(month.at("/outcomes/lostCount").asLong()).isZero();
        assertThat(amount(month.at("/outcomes/winRatePercent"))).isEqualByComparingTo("100.0");
        // Weekly buckets, each starting on a Monday, together holding exactly the period's revenue.
        assertThat(month.at("/trend").valueStream().map(p -> LocalDate.parse(p.at("/periodStart").asString()).getDayOfWeek()))
                .containsOnly(DayOfWeek.MONDAY);
        assertThat(month.at("/trend").valueStream().map(p -> amount(p.get("wonAmount"))).reduce(BigDecimal.ZERO, BigDecimal::add))
                .isEqualByComparingTo("1000");

        JsonNode quarter = dashboard(repA, "&range=LAST_90_DAYS");
        assertThat(amount(quarter.at("/outcomes/wonAmount"))).isEqualByComparingTo("5000");
        assertThat(quarter.at("/outcomes/lostCount").asLong()).isEqualTo(1);
        // 2 won of 3 closed; average of 1,000 and 4,000.
        assertThat(amount(quarter.at("/outcomes/winRatePercent"))).isEqualByComparingTo("66.7");
        assertThat(amount(quarter.at("/outcomes/averageDealSize"))).isEqualByComparingTo("2500.00");
        assertThat(quarter.at("/stages/5/count").asLong()).isEqualTo(1);

        JsonNode year = dashboard(repA, "&range=THIS_YEAR");
        assertThat(year.at("/period/from").asString()).isEqualTo(today.withDayOfYear(1).toString());
        assertThat(year.at("/trend")).hasSize(today.getMonthValue());

        assertThat(api.get(repA, "/api/v1/dashboard?range=LAST_WEEK")).hasStatus(HttpStatus.BAD_REQUEST);
    }

    // --- seed ---

    /**
     * RepA: open 10,000 Prospecting (closes today) and 40,000 Proposal (closes in two months), won 30,000, lost 5,000.
     * RepB: open 20,000 Negotiation (overdue), won 50,000, won 70,000 800 days ago, and an archived 99,000 Proposal.
     * Quotas: repA 100,000, repB 50,000, manager none. Leads: repA 2, repB 1, plus one archived. Contacts: 1.
     */
    private void seed() {
        String accountA = api.create(repA, "/api/v1/accounts", Map.of("name", "Contoso", "type", "ENTERPRISE"));
        String accountB = api.create(repB, "/api/v1/accounts", Map.of("name", "Fabrikam", "type", "SMB"));
        api.create(repA, "/api/v1/contacts", Map.of("accountId", accountA, "firstName", "Ada", "lastName", "Byron"));

        opportunity(repA, accountA, "A prospect", 10000, "PROSPECTING", today);
        opportunity(repA, accountA, "A proposal", 40000, "PROPOSAL", today.withDayOfMonth(1).plusMonths(2));
        opportunity(repA, accountA, "A win", 30000, "CLOSED_WON", today);
        opportunity(repA, accountA, "A loss", 5000, "CLOSED_LOST", today);
        opportunity(repB, accountB, "B negotiation", 20000, "NEGOTIATION", today.minusDays(40));
        opportunity(repB, accountB, "B win", 50000, "CLOSED_WON", today);
        closedDaysAgo(opportunity(repB, accountB, "B old win", 70000, "CLOSED_WON", today), 800);
        String archived = opportunity(repB, accountB, "B archived", 99000, "PROPOSAL", today);
        assertThat(api.post(manager, "/api/v1/opportunities/{id}/archive", null, archived)).hasStatusOk();

        api.create(repA, "/api/v1/leads", lead("one"));
        api.create(repA, "/api/v1/leads", lead("two"));
        api.create(repB, "/api/v1/leads", lead("three"));
        String archivedLead = api.create(repB, "/api/v1/leads", lead("four"));
        database.jdbc().update("update leads set archived_at = now() where id = ?::uuid", archivedLead);

        quota(repA, "100000");
        quota(repB, "50000");
    }

    private String opportunity(AuthenticatedUser owner, String accountId, String name, long amount, String stage,
            LocalDate closeDate) {
        Map<String, Object> body = new HashMap<>();
        body.put("accountId", accountId);
        body.put("name", name);
        body.put("amount", amount);
        body.put("stage", stage);
        body.put("closeDate", closeDate.toString());
        return api.create(owner, "/api/v1/opportunities", body);
    }

    private void closedDaysAgo(String opportunityId, int days) {
        database.jdbc().update("update opportunities set closed_at = now() - make_interval(days => ?) where id = ?::uuid",
                days, opportunityId);
    }

    private void quota(AuthenticatedUser rep, String quota) {
        database.jdbc().update("""
                insert into sales_reps (user_id, quota, created_at, updated_at) values (?::uuid, ?, now(), now())
                on conflict (user_id) do update set quota = excluded.quota""", rep.id(), new BigDecimal(quota));
    }

    private static Map<String, Object> lead(String tag) {
        return Map.of("firstName", "Lead", "lastName", tag, "company", "Co " + tag, "email", tag + "@leads.test");
    }

    private JsonNode dashboard(AuthenticatedUser actor, String query) {
        MvcTestResult result = api.get(actor, "/api/v1/dashboard?x=1" + query);
        assertThat(result).hasStatusOk();
        return api.body(result);
    }

    private static Map<String, JsonNode> byStage(JsonNode body) {
        Map<String, JsonNode> stages = new java.util.LinkedHashMap<>();
        body.at("/stages").valueStream().forEach(s -> stages.put(s.at("/stage").asString(), s));
        return stages;
    }

    private static void assertStage(JsonNode stage, long count, String amount, String weighted, String share) {
        assertThat(stage.at("/count").asLong()).isEqualTo(count);
        assertThat(amount(stage.at("/amount"))).isEqualByComparingTo(amount);
        assertThat(amount(stage.at("/weightedAmount"))).isEqualByComparingTo(weighted);
        assertThat(amount(stage.at("/sharePercent"))).isEqualByComparingTo(share);
    }

    private static BigDecimal amount(JsonNode node) {
        return node.decimalValue();
    }
}
