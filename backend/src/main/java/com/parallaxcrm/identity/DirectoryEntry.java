package com.parallaxcrm.identity;

import java.util.UUID;

/** Public view of a user for directory-style screens (never includes credentials). */
public record DirectoryEntry(UUID id, String email, String firstName, String lastName, Role role, boolean active) {

    public String fullName() {
        return firstName + " " + lastName;
    }
}
