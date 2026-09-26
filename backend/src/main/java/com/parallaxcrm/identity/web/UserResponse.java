package com.parallaxcrm.identity.web;

import com.parallaxcrm.identity.Role;
import com.parallaxcrm.identity.internal.User;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String email,
        String firstName,
        String lastName,
        String fullName,
        Role role,
        boolean active,
        @Nullable Instant lastLoginAt,
        Instant createdAt,
        long version) {

    static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getFirstName(), user.getLastName(),
                user.fullName(), user.getRole(), user.isActive(), user.getLastLoginAt(), user.getCreatedAt(),
                user.getVersion());
    }
}
