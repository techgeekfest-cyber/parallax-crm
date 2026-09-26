package com.parallaxcrm.identity;

import com.parallaxcrm.IntegrationTest;
import com.parallaxcrm.support.Browser;
import com.parallaxcrm.support.TestDatabase;
import com.parallaxcrm.support.TestUsers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import jakarta.servlet.http.Cookie;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** The complete sign-in lifecycle over HTTP, with real cookies, CSRF tokens and database-backed sessions. */
@IntegrationTest
class AuthIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    TestDatabase database;

    @Autowired
    TestUsers users;

    AuthenticatedUser rep;
    Browser browser;

    @BeforeEach
    void setUp() {
        database.reset();
        // A unique email per test: the login limiter is application-wide state shared by every test.
        rep = users.create(Role.SALES_REP, "maya.%s@parallax.test".formatted(UUID.randomUUID()), "Maya", "Chen");
        browser = new Browser(mvc);
    }

    @Test
    void signInStartsADatabaseBackedSessionWithHardenedCookie() {
        var result = browser.login(rep.email().toUpperCase(), TestUsers.PASSWORD);

        assertThat(result).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.id", v -> assertThat(v).isEqualTo(rep.id().toString()))
                .hasPathSatisfying("$.role", v -> assertThat(v).isEqualTo("SALES_REP"))
                .hasPathSatisfying("$.permissions.manageUsers", v -> assertThat(v).isEqualTo(false))
                .hasPathSatisfying("$.permissions.accessAllSalesRecords", v -> assertThat(v).isEqualTo(false));

        String setCookie = String.join("\n", result.getResponse().getHeaders("Set-Cookie"));
        assertThat(setCookie).contains("PARALLAX_SESSION=").contains("HttpOnly").contains("SameSite=Lax");
        assertThat(database.count("select count(*) from spring_session where principal_name = ?", rep.id().toString()))
                .isEqualTo(1);
        assertThat(database.count("select count(*) from users where id = ? and last_login_at is not null", rep.id()))
                .isEqualTo(1);

        assertThat(browser.get("/api/v1/auth/me")).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.email", v -> assertThat(v).isEqualTo(rep.email()));
    }

    @Test
    void anonymousRequestsNeverCreateSessions() {
        browser.get("/api/v1/auth/csrf");
        browser.login("nobody@parallax.test", "not a real password");

        assertThat(browser.cookie(Browser.SESSION_COOKIE)).isNull();
        assertThat(database.count("select count(*) from spring_session")).isZero();
    }

    @Test
    void signingInAgainRotatesTheSessionIdAndRetiresTheOldOne() {
        browser.login(rep.email(), TestUsers.PASSWORD);
        String before = browser.cookie(Browser.SESSION_COOKIE);

        browser.login(rep.email(), TestUsers.PASSWORD);
        String after = browser.cookie(Browser.SESSION_COOKIE);

        assertThat(after).isNotNull().isNotEqualTo(before);
        assertThat(mvc.get().uri("/api/v1/auth/me").cookie(new Cookie(Browser.SESSION_COOKIE, before)))
                .hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void signingInOnTopOfAnotherUsersSessionStartsAFreshOne() {
        AuthenticatedUser other = users.create(Role.SALES_MANAGER);
        browser.login(other.email(), TestUsers.PASSWORD);
        String othersSession = browser.cookie(Browser.SESSION_COOKIE);

        browser.login(rep.email(), TestUsers.PASSWORD);

        assertThat(browser.get("/api/v1/auth/me")).bodyJson()
                .hasPathSatisfying("$.id", v -> assertThat(v).isEqualTo(rep.id().toString()));
        assertThat(database.count("select count(*) from spring_session where principal_name = ?", other.id().toString()))
                .isZero();
        assertThat(mvc.get().uri("/api/v1/auth/me").cookie(new Cookie(Browser.SESSION_COOKIE, othersSession)))
                .hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void wrongPasswordUnknownEmailAndDeactivatedAccountAreIndistinguishable() {
        AuthenticatedUser inactive = users.create(Role.SALES_REP);
        database.jdbc().update("update users set active = false where id = ?", inactive.id());

        for (var attempt : new String[][] {
                {rep.email(), "wrong password!"},
                {"nobody@parallax.test", TestUsers.PASSWORD},
                {inactive.email(), TestUsers.PASSWORD}}) {
            assertThat(new Browser(mvc).login(attempt[0], attempt[1]))
                    .hasStatus(HttpStatus.UNAUTHORIZED)
                    .bodyJson()
                    .hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("UNAUTHENTICATED"))
                    .hasPathSatisfying("$.detail", v -> assertThat(v).isEqualTo("Email or password is incorrect."));
        }
    }

    @Test
    void repeatedFailuresLockTheAccountTemporarily() {
        for (int i = 0; i < 5; i++) {
            assertThat(browser.login(rep.email(), "wrong password " + i)).hasStatus(HttpStatus.UNAUTHORIZED);
        }

        var locked = browser.login(rep.email(), TestUsers.PASSWORD);
        assertThat(locked).hasStatus(HttpStatus.TOO_MANY_REQUESTS)
                .bodyJson().hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("RATE_LIMITED"));
        assertThat(locked.getResponse().getHeader("Retry-After")).isNotBlank();
    }

    @Test
    void writesWithoutACsrfTokenAreRejected() {
        browser.login(rep.email(), TestUsers.PASSWORD);
        browser.forget(Browser.CSRF_COOKIE);

        assertThat(browser.post("/api/v1/leads", "{}"))
                .hasStatus(HttpStatus.FORBIDDEN)
                .bodyJson().hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("CSRF_REJECTED"));
    }

    @Test
    void signOutDeletesTheServerSideSession() {
        browser.login(rep.email(), TestUsers.PASSWORD);

        assertThat(browser.logout()).hasStatus(HttpStatus.NO_CONTENT);

        assertThat(database.count("select count(*) from spring_session where principal_name = ?", rep.id().toString()))
                .isZero();
        assertThat(browser.get("/api/v1/auth/me")).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void dataSurvivesSignOutAndSignIn() {
        browser.login(rep.email(), TestUsers.PASSWORD);
        browser.write(b -> b.post("/api/v1/leads",
                "{\"firstName\":\"Ada\",\"lastName\":\"Lovelace\",\"company\":\"Engines\",\"email\":\"ada@engines.test\"}"));
        browser.logout();

        Browser later = new Browser(mvc);
        later.login(rep.email(), TestUsers.PASSWORD);
        assertThat(later.get("/api/v1/leads")).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.content[*].email", v -> assertThat(v).asArray().containsExactly("ada@engines.test"));
    }

    @Test
    void deactivationTakesEffectOnTheVeryNextRequest() {
        browser.login(rep.email(), TestUsers.PASSWORD);
        database.jdbc().update("update users set active = false where id = ?", rep.id());

        assertThat(browser.get("/api/v1/auth/me")).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void changingPasswordRequiresTheCurrentOneAndEndsOtherSessions() {
        browser.login(rep.email(), TestUsers.PASSWORD);
        Browser otherDevice = new Browser(mvc);
        otherDevice.login(rep.email(), TestUsers.PASSWORD);

        assertThat(browser.write(b -> b.put("/api/v1/auth/password",
                "{\"currentPassword\":\"not my password\",\"newPassword\":\"a brand new passphrase\"}")))
                .hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson().hasPathSatisfying("$.fieldErrors[0].field", v -> assertThat(v).isEqualTo("currentPassword"));

        assertThat(browser.write(b -> b.put("/api/v1/auth/password",
                "{\"currentPassword\":\"%s\",\"newPassword\":\"a brand new passphrase\"}".formatted(TestUsers.PASSWORD))))
                .hasStatus(HttpStatus.NO_CONTENT);

        assertThat(browser.get("/api/v1/auth/me")).hasStatusOk();
        assertThat(otherDevice.get("/api/v1/auth/me")).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(new Browser(mvc).login(rep.email(), "a brand new passphrase")).hasStatusOk();
        assertThat(database.count(
                "select count(*) from audit_events where entity_id = ? and changes->>'password' = 'changed'", rep.id()))
                .isEqualTo(1);
    }
}
