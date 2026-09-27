package com.parallaxcrm.salesteam;

import com.parallaxcrm.IntegrationTest;
import com.parallaxcrm.identity.AuthenticatedUser;
import com.parallaxcrm.identity.Role;
import com.parallaxcrm.support.Api;
import com.parallaxcrm.support.Browser;
import com.parallaxcrm.support.TestDatabase;
import com.parallaxcrm.support.TestUsers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@IntegrationTest
class SalesRepApiIntegrationTests {

    @Autowired
    Api api;

    @Autowired
    MockMvcTester mvc;

    @Autowired
    TestDatabase database;

    @Autowired
    TestUsers users;

    AuthenticatedUser admin;
    AuthenticatedUser manager;
    AuthenticatedUser rep;

    @BeforeEach
    void setUp() {
        database.reset();
        admin = users.create(Role.ADMIN);
        manager = users.create(Role.SALES_MANAGER);
        rep = users.create(Role.SALES_REP);
    }

    @Test
    void anAdminCreatesARepWhoCanSignInAndHasAProfile() {
        var body = new HashMap<String, Object>(Map.of(
                "email", "jonas.berg@parallax.test", "firstName", "Jonas", "lastName", "Berg", "role", "SALES_REP",
                "password", "initial passphrase", "territory", "Nordics", "title", "Account Executive",
                "quota", 400000));

        assertThat(api.post(admin, "/api/v1/sales-reps", body)).hasStatus(HttpStatus.CREATED).bodyJson()
                .hasPathSatisfying("$.territory", v -> assertThat(v).isEqualTo("Nordics"))
                .hasPathSatisfying("$.quota", v -> assertThat(v).isEqualTo(400000))
                .hasPathSatisfying("$.ytdSales", v -> assertThat(v).isEqualTo(0));
        assertThat(database.count("select count(*) from users u join sales_reps s on s.user_id = u.id "
                + "where u.email = 'jonas.berg@parallax.test'")).isEqualTo(1);
        assertThat(new Browser(mvc).login("jonas.berg@parallax.test", "initial passphrase")).hasStatusOk();
    }

    @Test
    void onlyAdminsCreateRepsAndOnlyWithASalesRole() {
        var body = new HashMap<String, Object>(Map.of(
                "email", "x@parallax.test", "firstName", "X", "lastName", "Y", "role", "SALES_REP",
                "password", "initial passphrase"));
        assertThat(api.post(manager, "/api/v1/sales-reps", body)).hasStatus(HttpStatus.FORBIDDEN);

        body.put("role", "ADMIN");
        assertThat(api.post(admin, "/api/v1/sales-reps", body)).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(database.count("select count(*) from users where email = 'x@parallax.test'")).isZero();
    }

    @Test
    void figuresAreComputedFromTheRecordsTheRepOwns() {
        String accountId = api.create(rep, "/api/v1/accounts", Map.of("name", "Acme", "type", "SMB"));
        api.create(rep, "/api/v1/leads", Map.of("firstName", "L", "lastName", "One", "company", "C", "email", "l1@x.test"));
        opportunity(accountId, 30000, "PROPOSAL");
        opportunity(accountId, 20000, "CLOSED_WON");
        opportunity(accountId, 99000, "CLOSED_LOST");
        api.put(manager, "/api/v1/sales-reps/{id}", profile(80000, 0), rep.id());

        assertThat(api.get(manager, "/api/v1/sales-reps/{id}", rep.id())).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.openLeadCount", v -> assertThat(v).isEqualTo(1))
                .hasPathSatisfying("$.accountCount", v -> assertThat(v).isEqualTo(1))
                .hasPathSatisfying("$.openOpportunityCount", v -> assertThat(v).isEqualTo(1))
                .hasPathSatisfying("$.openPipeline", v -> assertThat(v).isEqualTo(30000.0))
                .hasPathSatisfying("$.weightedPipeline", v -> assertThat(v).isEqualTo(15000.0))
                .hasPathSatisfying("$.ytdSales", v -> assertThat(v).isEqualTo(20000.0))
                .hasPathSatisfying("$.attainmentPercent", v -> assertThat(v).isEqualTo(25.0));
    }

    @Test
    void managersSetProfilesWithOptimisticLockingAndRepsCannot() {
        assertThat(api.put(rep, "/api/v1/sales-reps/{id}", profile(1000, 0), rep.id())).hasStatus(HttpStatus.FORBIDDEN);

        assertThat(api.put(manager, "/api/v1/sales-reps/{id}", profile(250000, 0), rep.id())).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.quota", v -> assertThat(v).isEqualTo(250000))
                .hasPathSatisfying("$.profileVersion", v -> assertThat(v).isEqualTo(1));
        assertThat(api.put(manager, "/api/v1/sales-reps/{id}", profile(300000, 0), rep.id()))
                .hasStatus(HttpStatus.CONFLICT);
        assertThat(api.put(manager, "/api/v1/sales-reps/{id}", profile(300000, 1), rep.id())).hasStatusOk();
        assertThat(database.count("select count(*) from audit_events where entity_type = 'SalesRep' and entity_id = ?",
                rep.id())).isEqualTo(2);
    }

    @Test
    void repsSeeOnlyThemselvesAndAdminsAreNotSalesReps() {
        assertThat(api.get(rep, "/api/v1/sales-reps")).bodyJson()
                .hasPathSatisfying("$.content[*].id", v -> assertThat(v).asArray().containsExactly(rep.id().toString()));
        assertThat(api.get(rep, "/api/v1/sales-reps/{id}", manager.id())).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(api.get(manager, "/api/v1/sales-reps")).bodyJson()
                .hasPathSatisfying("$.totalElements", v -> assertThat(v).isEqualTo(2));
        assertThat(api.get(manager, "/api/v1/sales-reps/{id}", admin.id())).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(api.get(manager, "/api/v1/sales-reps/{id}", UUID.randomUUID())).hasStatus(HttpStatus.NOT_FOUND);
    }

    private void opportunity(String accountId, long amount, String stage) {
        api.create(rep, "/api/v1/opportunities", Map.of("accountId", accountId, "name", stage + " deal",
                "amount", amount, "stage", stage, "closeDate", LocalDate.now().toString()));
    }

    private static Map<String, Object> profile(long quota, long version) {
        return Map.of("territory", "EMEA", "quota", quota, "version", version);
    }
}
