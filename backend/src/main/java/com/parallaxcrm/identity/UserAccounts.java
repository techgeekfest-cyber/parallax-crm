package com.parallaxcrm.identity;

import com.parallaxcrm.identity.internal.UserAdministration;
import com.parallaxcrm.identity.internal.UserAdministration.NewUser;
import org.springframework.stereotype.Component;

/**
 * Lets other modules create sign-in accounts through the same admin-only, audited path as the Users screen, so there
 * is exactly one user model.
 */
@Component
public class UserAccounts {

    private final UserAdministration administration;

    UserAccounts(UserAdministration administration) {
        this.administration = administration;
    }

    public DirectoryEntry create(String email, String firstName, String lastName, Role role, String password) {
        return administration.create(new NewUser(email, firstName, lastName, role, password)).toDirectoryEntry();
    }
}
