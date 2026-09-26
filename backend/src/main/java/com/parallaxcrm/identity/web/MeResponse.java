package com.parallaxcrm.identity.web;

import com.parallaxcrm.identity.AccessPolicy;
import com.parallaxcrm.identity.AuthenticatedUser;
import com.parallaxcrm.identity.Role;

import java.util.UUID;

/** The signed-in user and what the UI may offer them. The API enforces the same rules independently. */
public record MeResponse(
        UUID id,
        String email,
        String firstName,
        String lastName,
        String fullName,
        Role role,
        PermissionsResponse permissions) {

    public record PermissionsResponse(boolean manageUsers, boolean viewUsers, boolean accessAllSalesRecords) {
    }

    static MeResponse of(AuthenticatedUser user, AccessPolicy policy) {
        return new MeResponse(user.id(), user.email(), user.firstName(), user.lastName(), user.fullName(), user.role(),
                new PermissionsResponse(policy.canManageUsers(user), policy.canViewUsers(user),
                        policy.canAccessAllSalesRecords(user)));
    }
}
