package com.parallaxcrm.identity;

import com.parallaxcrm.shared.web.UserRefResponse;

import java.util.UUID;

/** Minimal public view of a user, e.g. to show a record's owner. */
public record UserSummary(UUID id, String fullName, Role role, boolean active) {

    /** Null-safe conversion to the shared reference shape used in API responses. */
    public static UserRefResponse ref(UserSummary user) {
        return user == null ? null : new UserRefResponse(user.id(), user.fullName(), user.active());
    }
}
