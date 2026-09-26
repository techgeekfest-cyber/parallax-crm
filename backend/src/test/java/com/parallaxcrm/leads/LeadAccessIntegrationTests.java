package com.parallaxcrm.leads;

import com.parallaxcrm.IntegrationTest;
import com.parallaxcrm.identity.AuthenticatedUser;
import com.parallaxcrm.identity.Role;
import com.parallaxcrm.support.TestDatabase;
import com.parallaxcrm.support.TestUsers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import tools.jackson.databind.json.JsonMapper;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static com.parallaxcrm.support.TestUsers.as;
import static org.assertj.core.api.Assertions.assertThat;

/** Record-level access to leads is enforced by the API, whatever the UI shows. */
@IntegrationTest
class LeadAccessIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    TestDatabase database;

    @Autowired
    TestUsers users;

    @Autowired
    JsonMapper json;

    AuthenticatedUser alice;
    AuthenticatedUser bob;
    AuthenticatedUser manager;

    @BeforeEach
    void setUp() {
        database.reset();
        alice = users.create(Role.SALES_REP);
        bob = users.create(Role.SALES_REP);
        manager = users.create(Role.SALES_MANAGER);
    }

    @Test
    void repsOnlySeeTheirOwnLeads() {
        create(alice, "alice-lead@example.com", null);
        create(bob, "bob-lead@example.com", null);

        assertThat(mvc.get().with(as(alice)).uri("/api/v1/leads")).bodyJson()
                .hasPathSatisfying("$.content[*].email", v -> assertThat(v).asArray().containsExactly("alice-lead@example.com"));
        assertThat(mvc.get().with(as(manager)).uri("/api/v1/leads")).bodyJson()
                .hasPathSatisfying("$.totalElements", v -> assertThat(v).isEqualTo(2));
    }

    @Test
    void repCannotOpenAnotherRepsLead() {
        String bobsLead = id(create(bob, "bob-lead@example.com", null));

        assertThat(mvc.get().with(as(alice)).uri("/api/v1/leads/{id}", bobsLead))
                .hasStatus(HttpStatus.FORBIDDEN)
                .bodyJson().hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("PERMISSION_DENIED"));
        assertThat(mvc.get().with(as(manager)).uri("/api/v1/leads/{id}", bobsLead)).hasStatusOk();
    }

    @Test
    void repCannotListAnotherRepsLeadsByOwnerFilter() {
        assertThat(mvc.get().with(as(alice)).uri("/api/v1/leads?ownerId={id}", bob.id()))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    @Test
    void repCannotAssignALeadToSomeoneElse() {
        assertThat(create(alice, "sneaky@example.com", bob.id()))
                .hasStatus(HttpStatus.FORBIDDEN)
                .bodyJson().hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("PERMISSION_DENIED"));
        assertThat(database.count("select count(*) from leads")).isZero();
    }

    @Test
    void managerAssignsLeadsAndCanFilterByOwner() {
        assertThat(create(manager, "for-bob@example.com", bob.id())).hasStatus(HttpStatus.CREATED).bodyJson()
                .hasPathSatisfying("$.owner.id", v -> assertThat(v).isEqualTo(bob.id().toString()));
        create(manager, "for-me@example.com", null);

        assertThat(mvc.get().with(as(manager)).uri("/api/v1/leads?ownerId={id}", bob.id())).bodyJson()
                .hasPathSatisfying("$.content[*].email", v -> assertThat(v).asArray().containsExactly("for-bob@example.com"));
        assertThat(mvc.get().with(as(bob)).uri("/api/v1/leads")).bodyJson()
                .hasPathSatisfying("$.totalElements", v -> assertThat(v).isEqualTo(1));
    }

    @Test
    void leadsCanOnlyBeAssignedToActiveUsers() {
        database.jdbc().update("update users set active = false where id = ?", bob.id());

        assertThat(create(manager, "for-inactive@example.com", bob.id()))
                .hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson().hasPathSatisfying("$.fieldErrors[0].field", v -> assertThat(v).isEqualTo("ownerId"));
        assertThat(create(manager, "for-nobody@example.com", UUID.randomUUID())).hasStatus(HttpStatus.BAD_REQUEST);
    }

    private MvcTestResult create(AuthenticatedUser actor, String email, UUID ownerId) {
        Map<String, Object> body = new HashMap<>(Map.of(
                "firstName", "Lead", "lastName", "Person", "company", "Acme", "email", email));
        if (ownerId != null) {
            body.put("ownerId", ownerId);
        }
        return mvc.post().with(as(actor)).uri("/api/v1/leads").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)).exchange();
    }

    private String id(MvcTestResult result) {
        return json.readTree(result.getResponse().getContentAsByteArray()).get("id").asString();
    }
}
