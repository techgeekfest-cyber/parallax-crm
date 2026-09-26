package com.parallaxcrm.identity;

import com.parallaxcrm.shared.error.PermissionDeniedException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The permission matrix, role by role. */
class AccessPolicyTests {

    private final AccessPolicy policy = new AccessPolicy();

    @ParameterizedTest(name = "{0}: own={1} others={2} manageUsers={3} viewUsers={4}")
    @CsvSource({
            "ADMIN,         true, true,  true,  true",
            "SALES_MANAGER, true, true,  false, true",
            "SALES_REP,     true, false, false, false"})
    void matrix(Role role, boolean ownRecords, boolean othersRecords, boolean manageUsers, boolean viewUsers) {
        AuthenticatedUser user = user(role);
        UUID someoneElse = UUID.randomUUID();

        assertThat(policy.canAccessRecordOwnedBy(user, user.id())).isEqualTo(ownRecords);
        assertThat(policy.canAccessRecordOwnedBy(user, someoneElse)).isEqualTo(othersRecords);
        assertThat(policy.canManageUsers(user)).isEqualTo(manageUsers);
        assertThat(policy.canViewUsers(user)).isEqualTo(viewUsers);
    }

    @ParameterizedTest
    @CsvSource({"ADMIN, true", "SALES_MANAGER, true", "SALES_REP, false"})
    void assigningToOthers(Role role, boolean allowed) {
        AuthenticatedUser user = user(role);

        assertThatCode(() -> policy.requireCanAssignTo(user, user.id())).doesNotThrowAnyException();
        if (allowed) {
            assertThatCode(() -> policy.requireCanAssignTo(user, UUID.randomUUID())).doesNotThrowAnyException();
        } else {
            assertThatThrownBy(() -> policy.requireCanAssignTo(user, UUID.randomUUID()))
                    .isInstanceOf(PermissionDeniedException.class);
        }
    }

    private static AuthenticatedUser user(Role role) {
        return new AuthenticatedUser(UUID.randomUUID(), "u@example.com", "Test", "User", role);
    }
}
