package com.parallaxcrm.identity.internal;

import com.parallaxcrm.shared.error.InvalidRequestException;

/**
 * Length-based policy (NIST SP 800-63B style): at least 12 characters, no composition rules. The upper bound is
 * bcrypt's 72-byte input limit.
 */
final class PasswordPolicy {

    static final int MIN_LENGTH = 12;
    static final int MAX_BYTES = 72;

    private PasswordPolicy() {
    }

    static void validate(String field, String password) {
        if (password == null || password.isBlank()) {
            throw new InvalidRequestException(field, "Enter a password.");
        }
        if (password.length() < MIN_LENGTH) {
            throw new InvalidRequestException(field, "Use at least %d characters.".formatted(MIN_LENGTH));
        }
        if (password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > MAX_BYTES) {
            throw new InvalidRequestException(field, "Use at most %d characters.".formatted(MAX_BYTES));
        }
    }
}
