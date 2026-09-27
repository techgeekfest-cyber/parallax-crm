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
import org.springframework.test.web.servlet.assertj.MvcTestResult;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** The opportunity stage workflow and the pipeline board over HTTP against real PostgreSQL. */
@IntegrationTest
class StageTransitionIntegrationTests {

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
    void aValidTransitionUpdatesStageProbabilityHistoryAuditAndTimelineTogether() {
        String id = opportunity(rep, "Rollout", 80000, "PROSPECTING", 15);

        MvcTestResult moved = transition(rep, id, "QUALIFICATION", 0, "Budget confirmed");

        assertThat(moved).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.stage", v -> assertThat(v).isEqualTo("QUALIFICATION"))
                .hasPathSatisfying("$.probability", v -> assertThat(v).isEqualTo(25)) // reset to the stage default
                .hasPathSatisfying("$.version", v -> assertThat(v).isEqualTo(1))
                .hasPathSatisfying("$.allowedStages", v -> assertThat(v).asArray()
                        .containsExactly("PROSPECTING", "PROPOSAL", "CLOSED_LOST"))
                .hasPathSatisfying("$.stageHistory[1].fromStage", v -> assertThat(v).isEqualTo("PROSPECTING"))
                .hasPathSatisfying("$.stageHistory[1].toStage", v -> assertThat(v).isEqualTo("QUALIFICATION"))
                .hasPathSatisfying("$.stageHistory[1].probability", v -> assertThat(v).isEqualTo(25))
                .hasPathSatisfying("$.stageHistory[1].amount", v -> assertThat(v).isEqualTo(80000.0))
                .hasPathSatisfying("$.stageHistory[1].changedBy.id", v -> assertThat(v).isEqualTo(rep.id().toString()));

        assertThat(database.count("""
                select count(*) from audit_events where entity_id = ?::uuid and action = 'STAGE_CHANGE'
                  and actor_id = ?::uuid and changes->'stage'->>'from' = 'PROSPECTING'
                  and changes->'stage'->>'to' = 'QUALIFICATION' and changes->'probability'->>'from' = '15'
                  and changes->>'note' = 'Budget confirmed'""", id, rep.id())).isEqualTo(1);
        assertThat(api.get(rep, "/api/v1/activities?opportunityId={id}", id)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.content[0].type", v -> assertThat(v).isEqualTo("STAGE_CHANGE"))
                .hasPathSatisfying("$.content[0].subject",
                        v -> assertThat(v).isEqualTo("Stage changed from Prospecting to Qualification"))
                .hasPathSatisfying("$.content[0].body", v -> assertThat(v).isEqualTo("Budget confirmed"))
                .hasPathSatisfying("$.content[0].actor.id", v -> assertThat(v).isEqualTo(rep.id().toString()));
    }

    @Test
    void aDealProgressesThroughEveryStageToWonAndCanBeReopened() {
        String id = opportunity(rep, "Full cycle", 10000, "PROSPECTING", null);
        long version = 0;
        for (String stage : List.of("QUALIFICATION", "PROPOSAL", "NEGOTIATION", "CLOSED_WON")) {
            assertThat(transition(rep, id, stage, version++, null)).hasStatusOk();
        }
        assertThat(api.get(rep, "/api/v1/opportunities/{id}", id)).bodyJson()
                .hasPathSatisfying("$.probability", v -> assertThat(v).isEqualTo(100))
                .hasPathSatisfying("$.closedAt", v -> assertThat(v).isNotNull());

        // Won can't flip straight to lost; it has to be reopened first, into any open stage.
        assertThat(transition(rep, id, "CLOSED_LOST", version, null)).hasStatus(HttpStatus.CONFLICT);
        assertThat(transition(rep, id, "PROPOSAL", version++, null)).hasStatusOk().bodyJson()
                .doesNotHavePath("$.closedAt")
                .hasPathSatisfying("$.probability", v -> assertThat(v).isEqualTo(50));
        assertThat(transition(rep, id, "CLOSED_LOST", version, "Chose a competitor")).hasStatusOk();

        assertThat(api.get(rep, "/api/v1/opportunities/{id}/stage-history", id)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$[*].toStage", v -> assertThat(v).asArray().containsExactly("PROSPECTING",
                        "QUALIFICATION", "PROPOSAL", "NEGOTIATION", "CLOSED_WON", "PROPOSAL", "CLOSED_LOST"))
                .hasPathSatisfying("$[5].fromStage", v -> assertThat(v).isEqualTo("CLOSED_WON"));
        assertThat(database.count("select count(*) from activities where opportunity_id = ?::uuid and type = 'STAGE_CHANGE'",
                id)).isEqualTo(6);
    }

    @Test
    void anInvalidTransitionChangesNothing() {
        String id = opportunity(rep, "Leapfrog", 5000, "PROSPECTING", null);

        assertThat(transition(rep, id, "NEGOTIATION", 0, null)).hasStatus(HttpStatus.CONFLICT).bodyJson()
                .hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("INVALID_STATE_TRANSITION"))
                .hasPathSatisfying("$.detail", v -> assertThat(v).asString()
                        .contains("can't move to Negotiation").contains("Qualification, Closed lost"));
        assertThat(transition(rep, id, "PROSPECTING", 0, null)).hasStatus(HttpStatus.CONFLICT);
        assertThat(api.post(rep, "/api/v1/opportunities/{id}/stage-transitions", Map.of("version", 0), id))
                .hasStatus(HttpStatus.BAD_REQUEST);

        assertThat(api.get(rep, "/api/v1/opportunities/{id}", id)).bodyJson()
                .hasPathSatisfying("$.stage", v -> assertThat(v).isEqualTo("PROSPECTING"))
                .hasPathSatisfying("$.version", v -> assertThat(v).isEqualTo(0));
        assertThat(database.count("select count(*) from opportunity_stage_history where opportunity_id = ?::uuid", id))
                .isEqualTo(1);
        assertThat(database.count("select count(*) from audit_events where action = 'STAGE_CHANGE'")).isZero();
        assertThat(database.count("select count(*) from activities")).isZero();
    }

    @Test
    void aStaleVersionIsAConflictNotAnOverwrite() {
        String id = opportunity(rep, "Contested", 5000, "PROPOSAL", null);
        // Someone else moved it first.
        assertThat(transition(manager, id, "NEGOTIATION", 0, null)).hasStatusOk();

        assertThat(transition(rep, id, "QUALIFICATION", 0, null)).hasStatus(HttpStatus.CONFLICT).bodyJson()
                .hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("CONFLICT"));
        assertThat(api.get(rep, "/api/v1/opportunities/{id}", id)).bodyJson()
                .hasPathSatisfying("$.stage", v -> assertThat(v).isEqualTo("NEGOTIATION"));
        assertThat(database.count("select count(*) from opportunity_stage_history where opportunity_id = ?::uuid", id))
                .isEqualTo(2);

        // An edit that raced with the transition is refused too.
        var edit = body("Contested", 6000, null, null);
        edit.put("version", 0);
        assertThat(api.put(rep, "/api/v1/opportunities/{id}", edit, id)).hasStatus(HttpStatus.CONFLICT);
    }

    @Test
    void onlyTheOwnerManagersAndAdminsMoveADeal() {
        String id = opportunity(rep, "Guarded", 5000, "PROSPECTING", null);

        assertThat(transition(otherRep, id, "QUALIFICATION", 0, null)).hasStatus(HttpStatus.FORBIDDEN).bodyJson()
                .hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("PERMISSION_DENIED"));
        assertThat(api.get(otherRep, "/api/v1/opportunities/{id}/stage-history", id)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(transition(manager, id, "QUALIFICATION", 0, null)).hasStatusOk();

        api.post(manager, "/api/v1/opportunities/{id}/archive", null, id);
        assertThat(transition(manager, id, "PROPOSAL", 2, null)).hasStatus(HttpStatus.BAD_REQUEST).bodyJson()
                .hasPathSatisfying("$.detail", v -> assertThat(v).asString().contains("Restore this opportunity"));
        assertThat(api.get(manager, "/api/v1/opportunities/{id}", id)).bodyJson()
                .hasPathSatisfying("$.allowedStages", v -> assertThat(v).asArray().isEmpty());
    }

    @Test
    void reassigningADealIsRecordedOnItsTimeline() {
        String id = opportunity(rep, "Handover", 5000, "PROSPECTING", null);
        var reassign = body("Handover", 5000, null, null);
        reassign.put("ownerId", otherRep.id());
        reassign.put("version", 0);

        assertThat(api.put(manager, "/api/v1/opportunities/{id}", reassign, id)).hasStatusOk();
        assertThat(api.get(otherRep, "/api/v1/activities?opportunityId={id}", id)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.content[0].type", v -> assertThat(v).isEqualTo("ASSIGNMENT"))
                .hasPathSatisfying("$.content[0].subject", v -> assertThat(v).asString().startsWith("Reassigned from Test"));
    }

    @Test
    void thePipelineBoardHasEveryStageWithServerComputedTotals() {
        opportunity(rep, "Early A", 1000, "PROSPECTING", null);
        opportunity(rep, "Early B", 3000, "PROSPECTING", null);
        opportunity(rep, "Late", 20000, "NEGOTIATION", null);
        opportunity(rep, "Won", 7000, "CLOSED_WON", null);
        opportunity(otherRep, "Not mine", 99000, "PROPOSAL", null);

        assertThat(api.get(rep, "/api/v1/pipeline")).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.columns[*].stage", v -> assertThat(v).asArray().containsExactly("PROSPECTING",
                        "QUALIFICATION", "PROPOSAL", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST"))
                .hasPathSatisfying("$.columns[0].count", v -> assertThat(v).isEqualTo(2))
                .hasPathSatisfying("$.columns[0].amount", v -> assertThat(v).isEqualTo(4000.0))
                .hasPathSatisfying("$.columns[0].weightedAmount", v -> assertThat(v).isEqualTo(400.0))
                .hasPathSatisfying("$.columns[0].opportunities[0].allowedStages", v -> assertThat(v).asArray()
                        .containsExactly("QUALIFICATION", "CLOSED_LOST"))
                .hasPathSatisfying("$.columns[0].opportunities[0].account.name", v -> assertThat(v).isEqualTo("Contoso"))
                .hasPathSatisfying("$.columns[2].count", v -> assertThat(v).isEqualTo(0)) // the other rep's deal
                .hasPathSatisfying("$.columns[3].weightedAmount", v -> assertThat(v).isEqualTo(15000.0))
                .hasPathSatisfying("$.totals.openCount", v -> assertThat(v).isEqualTo(3))
                .hasPathSatisfying("$.totals.openAmount", v -> assertThat(v).isEqualTo(24000.0))
                .hasPathSatisfying("$.totals.wonAmount", v -> assertThat(v).isEqualTo(7000.0));

        assertThat(api.get(manager, "/api/v1/pipeline?q=early&limit=1")).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.columns[0].count", v -> assertThat(v).isEqualTo(2))
                .hasPathSatisfying("$.columns[0].opportunities.length()", v -> assertThat(v).isEqualTo(1))
                .hasPathSatisfying("$.totals.openCount", v -> assertThat(v).isEqualTo(2));
        assertThat(api.get(manager, "/api/v1/pipeline")).bodyJson()
                .hasPathSatisfying("$.totals.openAmount", v -> assertThat(v).isEqualTo(123000.0));
        assertThat(api.get(rep, "/api/v1/pipeline?ownerId={id}", otherRep.id())).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(api.get(rep, "/api/v1/pipeline?limit=0")).hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void anEmptyPipelineHasSixEmptyColumns() {
        database.reset();
        AuthenticatedUser fresh = users.create(Role.SALES_REP);
        assertThat(api.get(fresh, "/api/v1/pipeline")).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.columns.length()", v -> assertThat(v).isEqualTo(6))
                .hasPathSatisfying("$.columns[*].count", v -> assertThat(v).asArray().containsOnly(0))
                .hasPathSatisfying("$.totals.openAmount", v -> assertThat(v).isEqualTo(0));
    }

    private MvcTestResult transition(AuthenticatedUser actor, String id, String toStage, long version, String note) {
        Map<String, Object> body = new HashMap<>(Map.of("toStage", toStage, "version", version));
        if (note != null) {
            body.put("note", note);
        }
        return api.post(actor, "/api/v1/opportunities/{id}/stage-transitions", body, id);
    }

    private String opportunity(AuthenticatedUser owner, String name, long amount, String stage, Integer probability) {
        return api.create(owner, "/api/v1/opportunities", body(name, amount, stage, probability));
    }

    private Map<String, Object> body(String name, long amount, String stage, Integer probability) {
        Map<String, Object> body = new HashMap<>();
        body.put("accountId", accountId);
        body.put("name", name);
        body.put("amount", amount);
        if (stage != null) {
            body.put("stage", stage);
        }
        if (probability != null) {
            body.put("probability", probability);
        }
        body.put("closeDate", LocalDate.now().plusMonths(1).toString());
        return body;
    }
}
