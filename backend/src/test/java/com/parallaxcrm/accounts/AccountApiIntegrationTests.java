package com.parallaxcrm.accounts;

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
import org.springframework.test.web.servlet.assertj.MockMvcTester;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@IntegrationTest
class AccountApiIntegrationTests {

    @Autowired
    Api api;

    @Autowired
    MockMvcTester mvc;

    @Autowired
    TestDatabase database;

    @Autowired
    TestUsers users;

    AuthenticatedUser rep;
    AuthenticatedUser otherRep;
    AuthenticatedUser manager;

    @BeforeEach
    void setUp() {
        database.reset();
        rep = users.create(Role.SALES_REP);
        otherRep = users.create(Role.SALES_REP);
        manager = users.create(Role.SALES_MANAGER);
    }

    @Test
    void anEnterpriseAccountIsPersistedWithItsProfileAndDerivedTier() {
        var body = account("Globex Corporation", "ENTERPRISE");
        body.put("annualRevenue", 2_500_000_000L);
        body.put("billingAddress", Map.of("street", "1 Globex Way", "city", "Springfield", "country", "US"));
        body.put("enterprise", Map.of("enterpriseId", "GLX-01", "globalEmployeeCount", 42000,
                "subsidiaries", List.of("Globex Labs", "Globex Europe"), "accountManagerId", manager.id(),
                "hasEnterpriseSupport", true));

        String id = api.create(rep, "/api/v1/accounts", body);

        assertThat(mvc.get().with(TestUsers.as(otherRep)).uri("/api/v1/accounts/{id}", id))
                .hasStatusOk().bodyJson()
                .hasPathSatisfying("$.number", v -> assertThat(v).asString().matches("ACC-\\d{6}"))
                .hasPathSatisfying("$.type", v -> assertThat(v).isEqualTo("ENTERPRISE"))
                .hasPathSatisfying("$.tier", v -> assertThat(v).isEqualTo("STRATEGIC"))
                .hasPathSatisfying("$.supportLevel", v -> assertThat(v).isEqualTo("DEDICATED"))
                .hasPathSatisfying("$.enterprise.subsidiaries", v -> assertThat(v).asArray()
                        .containsExactly("Globex Europe", "Globex Labs"))
                .hasPathSatisfying("$.accountManager.id", v -> assertThat(v).isEqualTo(manager.id().toString()))
                .hasPathSatisfying("$.owner.id", v -> assertThat(v).isEqualTo(rep.id().toString()))
                .hasPathSatisfying("$.billingAddress.city", v -> assertThat(v).isEqualTo("Springfield"))
                .hasPathSatisfying("$.permissions.canEdit", v -> assertThat(v).isEqualTo(false))
                .doesNotHavePath("$.smb");
        assertThat(database.count("select count(*) from enterprise_subsidiaries")).isEqualTo(2);
        assertThat(database.count("select count(*) from audit_events where entity_type = 'Account' and action = 'CREATE'"))
                .isEqualTo(1);
    }

    @Test
    void smbAndStartupAccountsUseTheirOwnSubtypeTables() {
        var smb = account("Corner Bakery", "SMB");
        smb.put("smb", Map.of("businessType", "Bakery", "yearsInBusiness", 12, "localBusiness", true));
        var startup = account("Rocketship AI", "STARTUP");
        startup.put("startup", Map.of("fundingRound", "SERIES_C", "totalFunding", 90_000_000));

        String smbId = api.create(rep, "/api/v1/accounts", smb);
        String startupId = api.create(rep, "/api/v1/accounts", startup);

        assertThat(api.body(api.get(rep, "/api/v1/accounts/{id}", smbId)).get("tier").asString()).isEqualTo("ESTABLISHED");
        assertThat(api.body(api.get(rep, "/api/v1/accounts/{id}", startupId)).get("supportLevel").asString())
                .isEqualTo("PRIORITY");
        assertThat(database.count("select count(*) from smb_accounts")).isEqualTo(1);
        assertThat(database.count("select count(*) from startup_accounts")).isEqualTo(1);
    }

    @Test
    void validationErrorsNameTheFields() {
        var body = account("", "SMB");
        body.put("annualRevenue", -10);

        assertThat(api.post(rep, "/api/v1/accounts", body))
                .hasStatus(HttpStatus.BAD_REQUEST).bodyJson()
                .hasPathSatisfying("$.fieldErrors[*].field", v -> assertThat(v).asArray().contains("name", "annualRevenue"));

        var wrongProfile = account("Mismatch Inc", "SMB");
        wrongProfile.put("startup", Map.of("fundingRound", "SEED"));
        assertThat(api.post(rep, "/api/v1/accounts", wrongProfile))
                .hasStatus(HttpStatus.BAD_REQUEST).bodyJson()
                .hasPathSatisfying("$.fieldErrors[0].field", v -> assertThat(v).isEqualTo("startup"));
        assertThat(database.count("select count(*) from accounts")).isZero();
    }

    @Test
    void accountNamesAreUniqueCaseInsensitivelyAmongActiveAccounts() {
        String first = api.create(rep, "/api/v1/accounts", account("Initech", "SMB"));

        assertThat(api.post(otherRep, "/api/v1/accounts", account("INITECH", "STARTUP")))
                .hasStatus(HttpStatus.CONFLICT).bodyJson()
                .hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("DUPLICATE_RECORD"));

        // Once archived, the name is free again — and restoring the old one then conflicts.
        api.post(manager, "/api/v1/accounts/{id}/archive", null, first);
        api.create(otherRep, "/api/v1/accounts", account("Initech", "SMB"));
        assertThat(api.post(manager, "/api/v1/accounts/{id}/restore", null, first)).hasStatus(HttpStatus.CONFLICT);
    }

    @Test
    void ownersAndManagersEditButOtherRepsCannot() {
        String id = api.create(rep, "/api/v1/accounts", account("Umbrella Retail", "SMB"));
        var update = account("Umbrella Retail Group", "SMB");
        update.put("version", 0);

        assertThat(api.put(otherRep, "/api/v1/accounts/{id}", update, id))
                .hasStatus(HttpStatus.FORBIDDEN).bodyJson()
                .hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("PERMISSION_DENIED"));
        assertThat(api.put(rep, "/api/v1/accounts/{id}", update, id)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.name", v -> assertThat(v).isEqualTo("Umbrella Retail Group"))
                .hasPathSatisfying("$.version", v -> assertThat(v).isEqualTo(1));
        update.put("version", 1);
        update.put("industry", "Retail");
        assertThat(api.put(manager, "/api/v1/accounts/{id}", update, id)).hasStatusOk();
        assertThat(database.count("select count(*) from audit_events where entity_id = ?::uuid and action = 'UPDATE'", id))
                .isEqualTo(2);
    }

    @Test
    void staleVersionsAndTypeChangesAreRejected() {
        String id = api.create(rep, "/api/v1/accounts", account("Hooli", "STARTUP"));
        var update = account("Hooli XYZ", "STARTUP");
        update.put("version", 0);
        api.put(rep, "/api/v1/accounts/{id}", update, id);

        assertThat(api.put(rep, "/api/v1/accounts/{id}", update, id))
                .hasStatus(HttpStatus.CONFLICT).bodyJson()
                .hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("CONFLICT"));

        var retype = account("Hooli XYZ", "ENTERPRISE");
        retype.put("version", 1);
        assertThat(api.put(rep, "/api/v1/accounts/{id}", retype, id))
                .hasStatus(HttpStatus.BAD_REQUEST).bodyJson()
                .hasPathSatisfying("$.fieldErrors[0].field", v -> assertThat(v).isEqualTo("type"));
    }

    @Test
    void repsCannotAssignAccountsToOthersButManagersCan() {
        var forOther = account("Stark Industries", "ENTERPRISE");
        forOther.put("ownerId", otherRep.id());

        assertThat(api.post(rep, "/api/v1/accounts", forOther)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(api.post(manager, "/api/v1/accounts", forOther)).hasStatus(HttpStatus.CREATED).bodyJson()
                .hasPathSatisfying("$.owner.id", v -> assertThat(v).isEqualTo(otherRep.id().toString()));
    }

    @Test
    void onlyManagersAndAdminsArchiveAndArchivedAccountsLeaveTheActiveList() {
        String id = api.create(rep, "/api/v1/accounts", account("Wayne Enterprises", "ENTERPRISE"));

        assertThat(api.post(rep, "/api/v1/accounts/{id}/archive", null, id)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(api.post(manager, "/api/v1/accounts/{id}/archive", null, id)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.archived", v -> assertThat(v).isEqualTo(true))
                .hasPathSatisfying("$.permissions.canEdit", v -> assertThat(v).isEqualTo(false));

        assertThat(api.body(api.get(rep, "/api/v1/accounts")).get("totalElements").asLong()).isZero();
        assertThat(api.body(api.get(rep, "/api/v1/accounts?archived=true")).get("totalElements").asLong()).isEqualTo(1);
        var update = account("Wayne Enterprises", "ENTERPRISE");
        update.put("version", 1);
        assertThat(api.put(rep, "/api/v1/accounts/{id}", update, id)).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(database.count("select count(*) from audit_events where entity_id = ?::uuid and action = 'ARCHIVE'", id))
                .isEqualTo(1);
    }

    @Test
    void listSearchesFiltersSortsAndPaginates() {
        api.create(rep, "/api/v1/accounts", withIndustry(account("Aperture Science", "ENTERPRISE"), "Research"));
        api.create(rep, "/api/v1/accounts", withIndustry(account("Black Mesa", "ENTERPRISE"), "Research"));
        api.create(otherRep, "/api/v1/accounts", withIndustry(account("Cyberdyne", "STARTUP"), "Robotics"));

        assertThat(api.get(rep, "/api/v1/accounts?q=research")).bodyJson()
                .hasPathSatisfying("$.content[*].name", v -> assertThat(v).asArray()
                        .containsExactly("Aperture Science", "Black Mesa"));
        assertThat(api.get(rep, "/api/v1/accounts?type=STARTUP")).bodyJson()
                .hasPathSatisfying("$.content[*].name", v -> assertThat(v).asArray().containsExactly("Cyberdyne"));
        assertThat(api.get(rep, "/api/v1/accounts?ownerId={id}", otherRep.id())).bodyJson()
                .hasPathSatisfying("$.totalElements", v -> assertThat(v).isEqualTo(1));
        assertThat(api.get(rep, "/api/v1/accounts?sort=name,desc&size=2&page=0")).bodyJson()
                .hasPathSatisfying("$.content[*].name", v -> assertThat(v).asArray()
                        .containsExactly("Cyberdyne", "Black Mesa"))
                .hasPathSatisfying("$.totalPages", v -> assertThat(v).isEqualTo(2));
        assertThat(api.get(rep, "/api/v1/accounts?sort=owner")).hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void accountsRequireAuthentication() {
        assertThat(mvc.get().uri("/api/v1/accounts")).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    private static Map<String, Object> account(String name, String type) {
        Map<String, Object> body = new HashMap<>();
        body.put("name", name);
        body.put("type", type);
        return body;
    }

    private static Map<String, Object> withIndustry(Map<String, Object> body, String industry) {
        body.put("industry", industry);
        return body;
    }
}
