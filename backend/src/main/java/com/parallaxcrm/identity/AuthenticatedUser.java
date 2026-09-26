package com.parallaxcrm.identity;

import java.util.UUID;

/** The user behind the current request, loaded fresh from the database for every request. */
public record AuthenticatedUser(UUID id, String email, String firstName, String lastName, Role role) {

    public String fullName() {
        return firstName + " " + lastName;
    }

    public boolean hasRole(Role candidate) {
        return role == candidate;
    }
}
