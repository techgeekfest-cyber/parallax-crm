package com.parallaxcrm.identity.internal;

import com.parallaxcrm.IntegrationTest;
import com.parallaxcrm.audit.AuditTrail;
import com.parallaxcrm.identity.Role;
import com.parallaxcrm.support.TestDatabase;
import com.parallaxcrm.support.TestUsers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;

@IntegrationTest
class AdminBootstrapIntegrationTests {

    @Autowired
    UserRepository users;

    @Autowired
    PasswordEncoder passwordEncoder;

    @Autowired
    AuditTrail auditTrail;

    @Autowired
    TransactionTemplate transaction;

    @Autowired
    TestDatabase database;

    @Autowired
    TestUsers testUsers;

    @BeforeEach
    void emptyDatabase() {
        database.reset();
    }

    @Test
    void createsTheFirstAdminOnAnEmptyDatabase() {
        assertThat(bootstrap("Owner@Parallax.test", "first admin passphrase").bootstrapIfEmpty()).isTrue();

        User admin = users.findByEmailIgnoreCase("owner@parallax.test").orElseThrow();
        assertThat(admin.getRole()).isEqualTo(Role.ADMIN);
        assertThat(passwordEncoder.matches("first admin passphrase", admin.getPasswordHash())).isTrue();
        assertThat(database.count("select count(*) from audit_events where entity_id = ? and actor_id is null",
                admin.getId())).isEqualTo(1);
    }

    @Test
    void neverTouchesADatabaseThatAlreadyHasUsers() {
        testUsers.create(Role.SALES_REP);

        assertThat(bootstrap("owner@parallax.test", "first admin passphrase").bootstrapIfEmpty()).isFalse();
        assertThat(database.count("select count(*) from users")).isEqualTo(1);
    }

    @Test
    void doesNothingWhenNotConfigured() {
        assertThat(bootstrap("", "").bootstrapIfEmpty()).isFalse();
        assertThat(database.count("select count(*) from users")).isZero();
    }

    private AdminBootstrap bootstrap(String email, String password) {
        return new AdminBootstrap(users, passwordEncoder, auditTrail, transaction, email, password);
    }
}
