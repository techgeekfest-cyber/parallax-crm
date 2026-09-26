package com.parallaxcrm.shared.security;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;
import java.util.UUID;

/**
 * Identifies who is acting in the current request without depending on the identity module. The authenticated
 * principal's name is always the user's UUID (see identity's AuthService).
 */
public final class Actors {

    private Actors() {
    }

    public static Optional<UUID> currentActorId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            return Optional.empty();
        }
        try {
            return Optional.of(UUID.fromString(authentication.getName()));
        } catch (IllegalArgumentException notAUserId) {
            return Optional.empty();
        }
    }
}
