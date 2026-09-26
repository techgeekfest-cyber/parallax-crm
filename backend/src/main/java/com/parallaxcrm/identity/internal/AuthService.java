package com.parallaxcrm.identity.internal;

import com.parallaxcrm.audit.AuditAction;
import com.parallaxcrm.audit.AuditTrail;
import com.parallaxcrm.identity.AuthenticatedUser;
import com.parallaxcrm.shared.error.InvalidRequestException;
import com.parallaxcrm.shared.error.UnauthenticatedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

@Service
public class AuthService {

    private static final String BAD_CREDENTIALS = "Email or password is incorrect.";

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final LoginAttemptLimiter limiter;
    private final SessionRevoker sessionRevoker;
    private final AuditTrail auditTrail;
    /** Compared against when the email is unknown, so response time doesn't reveal which emails exist. */
    private final String dummyHash;

    AuthService(UserRepository users, PasswordEncoder passwordEncoder, LoginAttemptLimiter limiter,
            SessionRevoker sessionRevoker, AuditTrail auditTrail) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.limiter = limiter;
        this.sessionRevoker = sessionRevoker;
        this.auditTrail = auditTrail;
        this.dummyHash = passwordEncoder.encode("parallax-timing-equaliser");
    }

    /**
     * Verifies credentials. Unknown emails, wrong passwords and deactivated accounts all produce the same error, so
     * the endpoint can't be used to discover accounts.
     */
    @Transactional
    public AuthenticatedUser login(String email, String password) {
        if (email == null || email.isBlank() || password == null || password.isEmpty()) {
            throw new UnauthenticatedException(BAD_CREDENTIALS);
        }
        String normalised = User.normaliseEmail(email);
        limiter.checkAllowed(normalised);

        Optional<User> candidate = users.findByEmailIgnoreCase(normalised);
        boolean passwordMatches = candidate
                .map(user -> passwordEncoder.matches(password, user.getPasswordHash()))
                .orElseGet(() -> {
                    passwordEncoder.matches(password, dummyHash);
                    return false;
                });

        if (!passwordMatches || !candidate.get().isActive()) {
            limiter.recordFailure(normalised);
            throw new UnauthenticatedException(BAD_CREDENTIALS);
        }

        limiter.reset(normalised);
        User user = candidate.get();
        users.recordLogin(user.getId(), Instant.now());
        return user.toAuthenticatedUser();
    }

    /** Changes the signed-in user's password and signs them out everywhere else. */
    @Transactional
    public void changePassword(AuthenticatedUser actor, String currentPassword, String newPassword,
            String currentSessionId) {
        User user = users.findById(actor.id()).orElseThrow(() -> new UnauthenticatedException("Sign in to continue."));
        if (currentPassword == null || !passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new InvalidRequestException("currentPassword", "Current password is incorrect.");
        }
        PasswordPolicy.validate("newPassword", newPassword);
        if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
            throw new InvalidRequestException("newPassword", "Choose a password you haven't just used.");
        }
        user.changePassword(passwordEncoder.encode(newPassword));
        auditTrail.record(AuditAction.UPDATE, UserAdministration.RECORD_TYPE, user.getId(), Map.of("password", "changed"));
        sessionRevoker.revokeAllExcept(user.getId(), currentSessionId);
    }
}
