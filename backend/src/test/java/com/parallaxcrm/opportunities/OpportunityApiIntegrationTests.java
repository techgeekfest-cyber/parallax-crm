package com.parallaxcrm.opportunities;

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

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@IntegrationTest
class OpportunityApiIntegrationTests {

    @Autowired
    Api api;

    @Autowired
    TestDatabase database;

    @Autowired
    TestUsers users;

    AuthenticatedUser rep;
    AuthenticatedUser otherRep;
    AuthenticatedUser manager;
    String accountId;

    @BeforeEach
    void setUp() {
        database.reset();
        rep = users.create(Role.SALES_REP);
        otherRep = users.create(Role.SALES_REP);
        manager = users.create(Role.SALES_MANAGER);
        accountId = api.create(rep, "/api/v1/accounts", Map.of("name", "Contoso", "type", "ENTERPRISE"));
    }

    @Test
    void anOpportunityIsLinkedToItsAccountWithStageDefaultsAndHistory() {
        var body = opportunity("Contoso platform rollout", 120000, "QUALIFICATION");
        body.put("type", "NEW_BUSINESS");
        body.put("leadSource", "REFERRAL");
        body.put("nextStep", "Security review");

        String id = api.create(rep, "/api/v1/opportunities", body);

        assertThat(api.get(rep, "/api/v1/opportunities/{id}", id)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.number", v -> assertThat(v).asString().matches("OPP-\\d{6}"))
                .hasPathSatisfying("$.account.id", v -> assertThat(v).isEqualTo(accountId))
                .hasPathSatisfying("$.probability", v -> assertThat(v).isEqualTo(25))
                .hasPathSatisfying("$.weightedAmount", v -> assertThat(v).isEqualTo(30000.0))
                .hasPathSatisfying("$.leadSource", v -> assertThat(v).isEqualTo("REFERRAL"))
                .doesNotHavePath("$.stageHistory[0].fromStage") // the initial stage has no predecessor
                .hasPathSatisfying("$.stageHistory[0].toStage", v -> assertThat(v).isEqualTo("QUALIFICATION"))
                .hasPathSatisfying("$.stageHistory[0].changedBy.id", v -> assertThat(v).isEqualTo(rep.id().toString()));
    }

    @Test
    void anEditCannotChangeTheStageButEditsOtherFieldsWithoutAddingHistory() {
        String id = api.create(rep, "/api/v1/opportunities", opportunity("Renewal 2027", 50000, "PROPOSAL"));
        var skipAhead = opportunity("Renewal 2027", 55000, "CLOSED_WON");
        skipAhead.put("version", 0);

        // Stages change only through the stage-transition workflow, never through a generic edit.
        assertThat(api.put(rep, "/api/v1/opportunities/{id}", skipAhead, id)).hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson().hasPathSatisfying("$.fieldErrors[0].field", v -> assertThat(v).isEqualTo("stage"));

        var edit = opportunity("Renewal 2027", 55000, "PROPOSAL");
        edit.put("version", 0);
        edit.put("nextStep", "Kick-off call");
        assertThat(api.put(rep, "/api/v1/opportunities/{id}", edit, id)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.nextStep", v -> assertThat(v).isEqualTo("Kick-off call"))
                .hasPathSatisfying("$.stage", v -> assertThat(v).isEqualTo("PROPOSAL"));
        assertThat(database.count("select count(*) from opportunity_stage_history where opportunity_id = ?::uuid", id))
                .isEqualTo(1);
    }

    @Test
    void anOpportunityCanBeCreatedInAClosedStageForAlreadyClosedDeals() {
        var won = opportunity("Signed last quarter", 20000, "CLOSED_WON");
        won.put("probability", 40);
        String id = api.create(rep, "/api/v1/opportunities", won);

        assertThat(api.get(rep, "/api/v1/opportunities/{id}", id)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.probability", v -> assertThat(v).isEqualTo(100))
                .hasPathSatisfying("$.closedAt", v -> assertThat(v).isNotNull());
    }

    @Test
    void repsSeeAndWorkOnlyTheirOwnOpportunities() {
        String mine = api.create(rep, "/api/v1/opportunities", opportunity("Mine", 1000, "PROSPECTING"));
        String theirs = api.create(otherRep, "/api/v1/opportunities", opportunity("Theirs", 2000, "PROSPECTING"));

        assertThat(api.get(rep, "/api/v1/opportunities")).bodyJson()
                .hasPathSatisfying("$.content[*].id", v -> assertThat(v).asArray().containsExactly(mine));
        assertThat(api.get(rep, "/api/v1/opportunities/{id}", theirs)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(api.get(rep, "/api/v1/opportunities?ownerId={id}", otherRep.id())).hasStatus(HttpStatus.FORBIDDEN);
        var edit = opportunity("Theirs, edited", 2000, "PROSPECTING");
        edit.put("version", 0);
        assertThat(api.put(rep, "/api/v1/opportunities/{id}", edit, theirs)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(api.get(manager, "/api/v1/opportunities")).bodyJson()
                .hasPathSatisfying("$.totalElements", v -> assertThat(v).isEqualTo(2));
    }

    @Test
    void assignmentFollowsTheRoleRules() {
        var forOther = opportunity("Handed over", 5000, "PROSPECTING");
        forOther.put("ownerId", otherRep.id());

        assertThat(api.post(rep, "/api/v1/opportunities", forOther)).hasStatus(HttpStatus.FORBIDDEN);
        String id = api.create(manager, "/api/v1/opportunities", forOther);
        assertThat(api.get(otherRep, "/api/v1/opportunities/{id}", id)).hasStatusOk();

        var reassign = opportunity("Handed over", 5000, "PROSPECTING");
        reassign.put("ownerId", rep.id());
        reassign.put("version", 0);
        assertThat(api.put(manager, "/api/v1/opportunities/{id}", reassign, id)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.owner.id", v -> assertThat(v).isEqualTo(rep.id().toString()));
        assertThat(api.get(otherRep, "/api/v1/opportunities/{id}", id)).hasStatus(HttpStatus.FORBIDDEN);
    }

    @Test
    void pipelineSummaryCoversOnlyWhatTheViewerCanSee() {
        api.create(rep, "/api/v1/opportunities", opportunity("A", 10000, "PROPOSAL"));
        api.create(rep, "/api/v1/opportunities", opportunity("B", 20000, "CLOSED_WON"));
        api.create(otherRep, "/api/v1/opportunities", opportunity("C", 40000, "NEGOTIATION"));

        assertThat(api.get(rep, "/api/v1/opportunities/summary?accountId={id}", accountId)).bodyJson()
                .hasPathSatisfying("$.openCount", v -> assertThat(v).isEqualTo(1))
                .hasPathSatisfying("$.openAmount", v -> assertThat(v).isEqualTo(10000.0))
                .hasPathSatisfying("$.weightedAmount", v -> assertThat(v).isEqualTo(5000.0))
                .hasPathSatisfying("$.wonAmount", v -> assertThat(v).isEqualTo(20000.0));
        assertThat(api.get(manager, "/api/v1/opportunities/summary?accountId={id}", accountId)).bodyJson()
                .hasPathSatisfying("$.openCount", v -> assertThat(v).isEqualTo(2))
                .hasPathSatisfying("$.weightedAmount", v -> assertThat(v).isEqualTo(35000.0));
    }

    @Test
    void anEmptyPipelineSummaryIsZeroNotAnError() {
        assertThat(api.get(rep, "/api/v1/opportunities/summary")).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.openCount", v -> assertThat(v).isEqualTo(0))
                .hasPathSatisfying("$.openAmount", v -> assertThat(v).isEqualTo(0));
    }

    @Test
    void listFiltersByStageAndAccountAndSortsByAmount() {
        String otherAccount = api.create(rep, "/api/v1/accounts", Map.of("name", "Fabrikam", "type", "SMB"));
        api.create(rep, "/api/v1/opportunities", opportunity("Small", 1000, "PROSPECTING"));
        api.create(rep, "/api/v1/opportunities", opportunity("Large", 90000, "NEGOTIATION"));
        var elsewhere = opportunity("Elsewhere", 5000, "NEGOTIATION");
        elsewhere.put("accountId", otherAccount);
        api.create(rep, "/api/v1/opportunities", elsewhere);

        assertThat(api.get(rep, "/api/v1/opportunities?stage=NEGOTIATION&sort=amount,desc")).bodyJson()
                .hasPathSatisfying("$.content[*].name", v -> assertThat(v).asArray().containsExactly("Large", "Elsewhere"));
        assertThat(api.get(rep, "/api/v1/opportunities?accountId={id}", otherAccount)).bodyJson()
                .hasPathSatisfying("$.content[*].name", v -> assertThat(v).asArray().containsExactly("Elsewhere"))
                .hasPathSatisfying("$.content[0].account.name", v -> assertThat(v).isEqualTo("Fabrikam"));
        assertThat(api.get(rep, "/api/v1/opportunities?q=larg")).bodyJson()
                .hasPathSatisfying("$.totalElements", v -> assertThat(v).isEqualTo(1));
    }

    @Test
    void validationAndArchivedAccountsAreRejected() {
        var invalid = opportunity("", -5, "PROSPECTING");
        invalid.remove("closeDate");
        assertThat(api.post(rep, "/api/v1/opportunities", invalid)).hasStatus(HttpStatus.BAD_REQUEST).bodyJson()
                .hasPathSatisfying("$.fieldErrors[*].field", v -> assertThat(v).asArray()
                        .contains("name", "amount", "closeDate"));

        api.post(manager, "/api/v1/accounts/{id}/archive", null, accountId);
        assertThat(api.post(rep, "/api/v1/opportunities", opportunity("Too late", 100, "PROSPECTING")))
                .hasStatus(HttpStatus.BAD_REQUEST).bodyJson()
                .hasPathSatisfying("$.fieldErrors[0].field", v -> assertThat(v).isEqualTo("accountId"));
    }

    @Test
    void onlyManagersArchiveAndTheDatabaseKeepsClosedAtConsistent() {
        String id = api.create(rep, "/api/v1/opportunities", opportunity("Archivable", 100, "CLOSED_LOST"));

        assertThat(api.post(rep, "/api/v1/opportunities/{id}/archive", null, id)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(api.post(manager, "/api/v1/opportunities/{id}/archive", null, id)).hasStatusOk();
        assertThat(api.get(rep, "/api/v1/opportunities?archived=true")).bodyJson()
                .hasPathSatisfying("$.totalElements", v -> assertThat(v).isEqualTo(1));
        assertThat(database.count("select count(*) from opportunities where closed_at is not null")).isEqualTo(1);
    }

    private Map<String, Object> opportunity(String name, long amount, String stage) {
        Map<String, Object> body = new HashMap<>();
        body.put("accountId", accountId);
        body.put("name", name);
        body.put("amount", amount);
        body.put("stage", stage);
        body.put("closeDate", LocalDate.now().plusMonths(1).toString());
        return body;
    }
}
