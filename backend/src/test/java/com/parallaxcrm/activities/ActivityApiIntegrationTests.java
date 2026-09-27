package com.parallaxcrm.activities;

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

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Logging activities and reading timelines, with access following the underlying record's rules. */
@IntegrationTest
class ActivityApiIntegrationTests {

    @Autowired
    Api api;

    @Autowired
    TestDatabase database;

    @Autowired
    TestUsers users;

    AuthenticatedUser rep;
    AuthenticatedUser otherRep;
    String accountId;
    String opportunityId;

    @BeforeEach
    void setUp() {
        database.reset();
        rep = users.create(Role.SALES_REP);
        otherRep = users.create(Role.SALES_REP);
        accountId = api.create(rep, "/api/v1/accounts", Map.of("name", "Fabrikam", "type", "SMB"));
        opportunityId = api.create(rep, "/api/v1/opportunities", Map.of("accountId", accountId, "name", "Fabrikam deal",
                "amount", 1000, "closeDate", LocalDate.now().plusMonths(1).toString()));
    }

    @Test
    void peopleLogCallsEmailsMeetingsAndNotesThatAppearNewestFirst() {
        Instant yesterday = Instant.now().minus(1, ChronoUnit.DAYS);
        assertThat(api.post(rep, "/api/v1/activities", Map.of("type", "CALL", "subject", "Discovery call",
                "body", "Needs SSO", "occurredAt", yesterday.toString(), "opportunityId", opportunityId)))
                .hasStatus(HttpStatus.CREATED).bodyJson()
                .hasPathSatisfying("$.type", v -> assertThat(v).isEqualTo("CALL"))
                .hasPathSatisfying("$.system", v -> assertThat(v).isEqualTo(false))
                .hasPathSatisfying("$.actor.id", v -> assertThat(v).isEqualTo(rep.id().toString()))
                .hasPathSatisfying("$.opportunityId", v -> assertThat(v).isEqualTo(opportunityId));
        api.post(rep, "/api/v1/activities", Map.of("type", "NOTE", "subject", "Follow up next week",
                "opportunityId", opportunityId));

        assertThat(api.get(rep, "/api/v1/activities?opportunityId={id}", opportunityId)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.totalElements", v -> assertThat(v).isEqualTo(2))
                .hasPathSatisfying("$.content[*].subject", v -> assertThat(v).asArray()
                        .containsExactly("Follow up next week", "Discovery call"))
                .hasPathSatisfying("$.content[1].body", v -> assertThat(v).isEqualTo("Needs SSO"));
        // Stored in PostgreSQL, not just echoed back.
        assertThat(database.count("select count(*) from activities where opportunity_id = ?::uuid and actor_id = ?::uuid",
                opportunityId, rep.id())).isEqualTo(2);
    }

    @Test
    void workflowTypesCannotBeLoggedByHand() {
        assertThat(api.post(rep, "/api/v1/activities", Map.of("type", "STAGE_CHANGE", "subject", "Fake move",
                "opportunityId", opportunityId))).hasStatus(HttpStatus.BAD_REQUEST).bodyJson()
                .hasPathSatisfying("$.fieldErrors[0].field", v -> assertThat(v).isEqualTo("type"));
        assertThat(database.count("select count(*) from activities")).isZero();
    }

    @Test
    void anActivityBelongsToExactlyOneRecordAndHappenedInThePast() {
        assertThat(api.post(rep, "/api/v1/activities", Map.of("type", "NOTE", "subject", "Nowhere")))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(api.post(rep, "/api/v1/activities", Map.of("type", "NOTE", "subject", "Two places",
                "accountId", accountId, "opportunityId", opportunityId))).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(api.post(rep, "/api/v1/activities", Map.of("type", "MEETING", "subject", "Next month",
                "occurredAt", Instant.now().plus(30, ChronoUnit.DAYS).toString(), "accountId", accountId)))
                .hasStatus(HttpStatus.BAD_REQUEST).bodyJson()
                .hasPathSatisfying("$.fieldErrors[0].field", v -> assertThat(v).isEqualTo("occurredAt"));
        assertThat(api.post(rep, "/api/v1/activities", Map.of("type", "NOTE", "subject", " ", "accountId", accountId)))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(api.get(rep, "/api/v1/activities")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(database.count("select count(*) from activities")).isZero();
    }

    @Test
    void timelinesFollowTheRecordsAccessRules() {
        // Another rep can neither read nor add to someone else's opportunity timeline…
        assertThat(api.get(otherRep, "/api/v1/activities?opportunityId={id}", opportunityId))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(api.post(otherRep, "/api/v1/activities", Map.of("type", "NOTE", "subject", "Sneaky",
                "opportunityId", opportunityId))).hasStatus(HttpStatus.FORBIDDEN);
        // …but accounts are shared, so their timelines are too.
        assertThat(api.post(otherRep, "/api/v1/activities", Map.of("type", "EMAIL", "subject", "Intro email",
                "accountId", accountId))).hasStatus(HttpStatus.CREATED);
        assertThat(api.get(rep, "/api/v1/activities?accountId={id}", accountId)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.content[0].actor.id", v -> assertThat(v).isEqualTo(otherRep.id().toString()));

        assertThat(api.get(rep, "/api/v1/activities?leadId={id}", "0198c0de-0000-7000-8000-000000000000"))
                .hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void archivedRecordsKeepTheirTimelineButTakeNoNewActivities() {
        AuthenticatedUser manager = users.create(Role.SALES_MANAGER);
        api.post(rep, "/api/v1/activities", Map.of("type", "NOTE", "subject", "Before archiving", "accountId", accountId));
        api.post(manager, "/api/v1/accounts/{id}/archive", null, accountId);

        assertThat(api.post(rep, "/api/v1/activities", Map.of("type", "NOTE", "subject", "After", "accountId", accountId)))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(api.get(rep, "/api/v1/activities?accountId={id}", accountId)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.totalElements", v -> assertThat(v).isEqualTo(1));
    }
}
