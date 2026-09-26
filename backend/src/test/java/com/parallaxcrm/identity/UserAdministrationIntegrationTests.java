package com.parallaxcrm.identity;

import com.parallaxcrm.IntegrationTest;
import com.parallaxcrm.support.Browser;
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

import java.util.Map;

import static com.parallaxcrm.support.TestUsers.as;
import static org.assertj.core.api.Assertions.assertThat;

@IntegrationTest
class UserAdministrationIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    TestDatabase database;

    @Autowired
    TestUsers users;

    @Autowired
    JsonMapper json;

    AuthenticatedUser admin;

    @BeforeEach
    void setUp() {
        database.reset();
        admin = users.create(Role.ADMIN);
    }

    @Test
    void adminCreatesAUserWhoCanThenSignIn() {
        var created = createUser(admin, "Jonas.Berg@parallax.test", Role.SALES_REP, "initial passphrase");

        assertThat(created).hasStatus(HttpStatus.CREATED).bodyJson()
                .hasPathSatisfying("$.email", v -> assertThat(v).isEqualTo("jonas.berg@parallax.test"))
                .hasPathSatisfying("$.active", v -> assertThat(v).isEqualTo(true))
                .doesNotHavePath("$.password")
                .doesNotHavePath("$.passwordHash");
        assertThat(new Browser(mvc).login("jonas.berg@parallax.test", "initial passphrase")).hasStatusOk();
        assertThat(database.count("select count(*) from audit_events where entity_type = 'User' and action = 'CREATE' "
                + "and actor_id = ?", admin.id())).isEqualTo(1);
    }

    @Test
    void emailsAreUniqueAndPasswordsMustBeLongEnough() {
        createUser(admin, "jonas@parallax.test", Role.SALES_REP, "initial passphrase");

        assertThat(createUser(admin, "JONAS@parallax.test", Role.SALES_REP, "initial passphrase"))
                .hasStatus(HttpStatus.CONFLICT)
                .bodyJson().hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("DUPLICATE_RECORD"));
        assertThat(createUser(admin, "short@parallax.test", Role.SALES_REP, "too short"))
                .hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson().hasPathSatisfying("$.fieldErrors[0].field", v -> assertThat(v).isEqualTo("password"));
    }

    @Test
    void onlyAdminsManageUsersAndRepsCannotSeeTheDirectory() {
        AuthenticatedUser manager = users.create(Role.SALES_MANAGER);
        AuthenticatedUser rep = users.create(Role.SALES_REP);

        assertThat(createUser(manager, "x@parallax.test", Role.SALES_REP, "initial passphrase"))
                .hasStatus(HttpStatus.FORBIDDEN)
                .bodyJson().hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("PERMISSION_DENIED"));
        assertThat(mvc.get().with(as(manager)).uri("/api/v1/users")).hasStatusOk()
                .bodyJson().hasPathSatisfying("$.totalElements", v -> assertThat(v).isEqualTo(3));
        assertThat(mvc.get().with(as(rep)).uri("/api/v1/users")).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(database.count("select count(*) from users")).isEqualTo(3);
    }

    @Test
    void roleChangeEndsTheUsersSessionsAndIsAudited() {
        AuthenticatedUser rep = users.create(Role.SALES_REP);
        Browser repBrowser = new Browser(mvc);
        repBrowser.login(rep.email(), TestUsers.PASSWORD);

        assertThat(update(admin, rep, Role.SALES_MANAGER, true, 0)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.role", v -> assertThat(v).isEqualTo("SALES_MANAGER"))
                .hasPathSatisfying("$.version", v -> assertThat(v).isEqualTo(1));

        assertThat(repBrowser.get("/api/v1/auth/me")).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(database.count("select count(*) from audit_events where entity_id = ? and action = 'UPDATE' "
                + "and changes->'role'->>'to' = 'SALES_MANAGER'", rep.id())).isEqualTo(1);
    }

    @Test
    void signingInDoesNotMakeAnAdminsEditStale() {
        AuthenticatedUser rep = users.create(Role.SALES_REP);
        new Browser(mvc).login(rep.email(), TestUsers.PASSWORD);

        assertThat(update(admin, rep, Role.SALES_REP, true, 0)).hasStatusOk();
    }

    @Test
    void staleVersionIsAConflictAndChangesNothing() {
        AuthenticatedUser rep = users.create(Role.SALES_REP);
        update(admin, rep, Role.SALES_REP, false, 0);

        assertThat(update(admin, rep, Role.SALES_MANAGER, true, 0))
                .hasStatus(HttpStatus.CONFLICT)
                .bodyJson().hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("CONFLICT"));
        assertThat(database.count("select count(*) from users where id = ? and role = 'SALES_REP' and not active",
                rep.id())).isEqualTo(1);
    }

    @Test
    void adminsCannotLockThemselvesOut() {
        assertThat(update(admin, admin, Role.SALES_REP, true, 0)).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(update(admin, admin, Role.ADMIN, false, 0)).hasStatus(HttpStatus.BAD_REQUEST);
    }

    private MvcTestResult createUser(AuthenticatedUser actor, String email, Role role, String password) {
        return mvc.post().with(as(actor)).uri("/api/v1/users").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "firstName", "Jonas", "lastName", "Berg",
                        "role", role, "password", password)))
                .exchange();
    }

    private MvcTestResult update(AuthenticatedUser actor, AuthenticatedUser target, Role role, boolean active,
            long version) {
        return mvc.put().with(as(actor)).uri("/api/v1/users/{id}", target.id()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("firstName", target.firstName(), "lastName", target.lastName(),
                        "role", role, "active", active, "version", version)))
                .exchange();
    }
}
