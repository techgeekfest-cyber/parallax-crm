package com.parallaxcrm.identity;

import java.util.UUID;

/** Minimal public view of a user, e.g. to show a record's owner. */
public record UserSummary(UUID id, String fullName, Role role, boolean active) {
}
