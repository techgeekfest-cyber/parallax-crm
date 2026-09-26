package com.parallaxcrm.identity.internal;

import com.parallaxcrm.audit.AuditAction;
import com.parallaxcrm.audit.AuditTrail;
import com.parallaxcrm.identity.Role;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Map;

/**
 * Creates the first administrator, and only when the users table is empty and both bootstrap settings are present.
 * This is the application's only automatic data creation; it never touches a database that already has users.
 */
@Component
class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AuditTrail auditTrail;
    private final TransactionTemplate transaction;
    private final String email;
    private final String password;

    AdminBootstrap(UserRepository users, PasswordEncoder passwordEncoder, AuditTrail auditTrail,
            TransactionTemplate transaction,
            @Value("${parallax.bootstrap.admin-email:}") String email,
            @Value("${parallax.bootstrap.admin-password:}") String password) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.auditTrail = auditTrail;
        this.transaction = transaction;
        this.email = email;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) {
        bootstrapIfEmpty();
    }

    /** @return whether an admin was created */
    boolean bootstrapIfEmpty() {
        if (email.isBlank() || password.isBlank()) {
            return false;
        }
        Boolean created = transaction.execute(status -> {
            if (users.count() > 0) {
                return false;
            }
            PasswordPolicy.validate("ADMIN_BOOTSTRAP_PASSWORD", password);
            User admin = users.saveAndFlush(
                    User.create(email, "Parallax", "Admin", Role.ADMIN, passwordEncoder.encode(password)));
            auditTrail.record(AuditAction.CREATE, UserAdministration.RECORD_TYPE, admin.getId(),
                    Map.of("email", admin.getEmail(), "role", Role.ADMIN, "source", "bootstrap"));
            return true;
        });
        if (Boolean.TRUE.equals(created)) {
            log.info("Created the initial administrator account {}", User.normaliseEmail(email));
        }
        return Boolean.TRUE.equals(created);
    }
}
