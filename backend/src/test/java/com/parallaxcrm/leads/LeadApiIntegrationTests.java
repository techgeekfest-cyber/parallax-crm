package com.parallaxcrm.leads;

import com.parallaxcrm.IntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import tools.jackson.databind.json.JsonMapper;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Exercises the lead vertical slice over HTTP against real PostgreSQL. Each request runs in its own transaction,
 * exactly as in production — nothing is rolled back behind the test's back.
 */
@IntegrationTest
class LeadApiIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    JsonMapper json;

    @BeforeEach
    void emptyDatabase() {
        jdbc.execute("truncate table leads, audit_events cascade");
    }

    @Test
    void listIsEmptyOnAFreshDatabase() {
        assertThat(mvc.get().uri("/api/v1/leads"))
                .hasStatusOk()
                .bodyJson()
                .hasPathSatisfying("$.content", content -> assertThat(content).asArray().isEmpty())
                .hasPathSatisfying("$.totalElements", total -> assertThat(total).isEqualTo(0));
    }

    @Test
    void createdLeadIsPersistedAndReadableInALaterRequest() {
        MvcTestResult created = create(lead("Ada", "Lovelace", "Analytical Engines", "Ada@Example.com"));

        assertThat(created).hasStatus(HttpStatus.CREATED);
        String id = field(created, "id");
        assertThat(created.getResponse().getHeader("Location")).endsWith("/api/v1/leads/" + id);
        assertThat(field(created, "number")).matches("LD-\\d{6}");

        assertThat(mvc.get().uri("/api/v1/leads/{id}", id))
                .hasStatusOk()
                .bodyJson()
                .hasPathSatisfying("$.fullName", v -> assertThat(v).isEqualTo("Ada Lovelace"))
                .hasPathSatisfying("$.email", v -> assertThat(v).isEqualTo("ada@example.com"))
                .hasPathSatisfying("$.status", v -> assertThat(v).isEqualTo("NEW"))
                .hasPathSatisfying("$.estimatedValue", v -> assertThat(v).isEqualTo(42000.5))
                .hasPathSatisfying("$.version", v -> assertThat(v).isEqualTo(0));

        Integer rows = jdbc.queryForObject("select count(*) from leads where id = ?::uuid", Integer.class, id);
        assertThat(rows).isEqualTo(1);
    }

    @Test
    void creatingALeadWritesAnAuditEventInTheSameTransaction() {
        String id = field(create(lead("Ada", "Lovelace", "Analytical Engines", "ada@example.com")), "id");

        var audit = jdbc.queryForMap(
                "select action, entity_type, changes->>'email' as email from audit_events where entity_id = ?::uuid",
                id);
        assertThat(audit).containsEntry("action", "CREATE")
                .containsEntry("entity_type", "Lead")
                .containsEntry("email", "ada@example.com");
    }

    @Test
    void duplicateEmailIsRejectedCaseInsensitively() {
        create(lead("Ada", "Lovelace", "Analytical Engines", "ada@example.com"));

        assertThat(create(lead("Augusta", "King", "Other Co", "ADA@example.com")))
                .hasStatus(HttpStatus.CONFLICT)
                .bodyJson()
                .hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("DUPLICATE_RECORD"))
                .hasPathSatisfying("$.fieldErrors[0].field", v -> assertThat(v).isEqualTo("email"));

        assertThat(jdbc.queryForObject("select count(*) from leads", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from audit_events", Integer.class)).isEqualTo(1);
    }

    @Test
    void invalidInputReturnsFieldErrorsAndPersistsNothing() {
        var body = Map.of("firstName", "", "lastName", "Lovelace", "company", "Analytical Engines",
                "email", "not-an-email", "estimatedValue", -5);

        assertThat(create(body))
                .hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson()
                .hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("VALIDATION_FAILED"))
                .hasPathSatisfying("$.fieldErrors[*].field",
                        v -> assertThat(v).asArray().contains("firstName", "email", "estimatedValue"));

        assertThat(jdbc.queryForObject("select count(*) from leads", Integer.class)).isZero();
    }

    @Test
    void malformedJsonIsABadRequest() {
        assertThat(mvc.post().uri("/api/v1/leads").contentType(MediaType.APPLICATION_JSON).content("{\"firstName\":"))
                .hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson().hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("BAD_REQUEST"));
    }

    @Test
    void unknownLeadIsNotFound() {
        assertThat(mvc.get().uri("/api/v1/leads/{id}", UUID.randomUUID()))
                .hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("RECORD_NOT_FOUND"));
    }

    @Test
    void malformedIdIsABadRequest() {
        assertThat(mvc.get().uri("/api/v1/leads/not-a-uuid")).hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void listSearchesAcrossNameCompanyAndEmail() {
        create(lead("Ada", "Lovelace", "Analytical Engines", "ada@example.com"));
        create(lead("Grace", "Hopper", "Navy Labs", "grace@navy.example"));
        create(lead("Alan", "Turing", "Bletchley Park", "alan@bletchley.example"));

        assertThat(mvc.get().uri("/api/v1/leads?q=navy"))
                .bodyJson()
                .hasPathSatisfying("$.content[*].fullName", v -> assertThat(v).asArray().containsExactly("Grace Hopper"));
        assertThat(mvc.get().uri("/api/v1/leads?q=LOVELACE"))
                .bodyJson()
                .hasPathSatisfying("$.totalElements", v -> assertThat(v).isEqualTo(1));
        assertThat(mvc.get().uri("/api/v1/leads?q=100%25"))
                .bodyJson()
                .hasPathSatisfying("$.totalElements", v -> assertThat(v).isEqualTo(0));
    }

    @Test
    void listFiltersByStatusAndPaginatesWithStableSort() {
        create(lead("Ada", "Lovelace", "C Company", "ada@example.com"));
        create(lead("Grace", "Hopper", "A Company", "grace@example.com"));
        create(lead("Alan", "Turing", "B Company", "alan@example.com"));

        assertThat(mvc.get().uri("/api/v1/leads?status=QUALIFIED"))
                .bodyJson().hasPathSatisfying("$.totalElements", v -> assertThat(v).isEqualTo(0));

        assertThat(mvc.get().uri("/api/v1/leads?sort=company,asc&size=2&page=0"))
                .bodyJson()
                .hasPathSatisfying("$.content[*].company",
                        v -> assertThat(v).asArray().containsExactly("A Company", "B Company"))
                .hasPathSatisfying("$.totalPages", v -> assertThat(v).isEqualTo(2));

        assertThat(mvc.get().uri("/api/v1/leads?sort=company,asc&size=2&page=1"))
                .bodyJson()
                .hasPathSatisfying("$.content[*].company", v -> assertThat(v).asArray().containsExactly("C Company"));
    }

    @Test
    void sortingOnAnUnlistedFieldIsRejected() {
        assertThat(mvc.get().uri("/api/v1/leads?sort=notes"))
                .hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson().hasPathSatisfying("$.fieldErrors[0].field", v -> assertThat(v).isEqualTo("sort"));
    }

    private MvcTestResult create(Map<String, ?> body) {
        return mvc.post().uri("/api/v1/leads")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body))
                .exchange();
    }

    private String field(MvcTestResult result, String name) {
        return json.readTree(result.getResponse().getContentAsByteArray()).get(name).asString();
    }

    private static Map<String, Object> lead(String firstName, String lastName, String company, String email) {
        return Map.of("firstName", firstName, "lastName", lastName, "company", company, "email", email,
                "source", "REFERRAL", "estimatedValue", 42000.50);
    }
}
