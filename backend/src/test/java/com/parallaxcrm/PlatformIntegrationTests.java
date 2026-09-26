package com.parallaxcrm;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

import static org.assertj.core.api.Assertions.assertThat;

@IntegrationTest
class PlatformIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void healthEndpointReportsUpIncludingDatabase() {
        assertThat(mvc.get().uri("/actuator/health"))
                .hasStatusOk()
                .bodyJson().extractingPath("$.status").isEqualTo("UP");
    }

    @Test
    void everyResponseCarriesARequestId() {
        assertThat(mvc.get().uri("/actuator/health")).headers().containsHeader("X-Request-Id");
    }

    @Test
    void wellFormedIncomingRequestIdIsPropagated() {
        assertThat(mvc.get().uri("/actuator/health").header("X-Request-Id", "trace-12345678"))
                .headers().hasValue("X-Request-Id", "trace-12345678");
    }

    @Test
    void unknownRoutesReturnProblemDetailWithoutInternals() {
        assertThat(mvc.get().uri("/api/v1/does-not-exist"))
                .hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson()
                .hasPathSatisfying("$.code", code -> assertThat(code).isEqualTo("NOT_FOUND"))
                .doesNotHavePath("$.trace");
    }

    @Test
    void flywayCreatedTheCoreSchema() {
        var tables = jdbc.queryForList("""
                select table_name from information_schema.tables
                where table_schema = 'public' and table_type = 'BASE TABLE'
                """, String.class);
        assertThat(tables).contains(
                "users", "sales_reps", "accounts", "enterprise_accounts", "enterprise_subsidiaries", "smb_accounts",
                "startup_accounts", "contacts", "opportunities", "opportunity_stage_history", "leads", "activities",
                "audit_events", "flyway_schema_history");
    }

    @Test
    void openApiDocumentIsServed() {
        assertThat(mvc.get().uri("/v3/api-docs"))
                .hasStatusOk()
                .bodyJson().extractingPath("$.info.title").isEqualTo("ParallaxCRM API");
    }
}
