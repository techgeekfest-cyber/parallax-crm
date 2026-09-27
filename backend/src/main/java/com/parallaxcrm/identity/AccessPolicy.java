package com.parallaxcrm.identity;

import com.parallaxcrm.shared.error.PermissionDeniedException;
import org.springframework.stereotype.Component;

import java.util.Objects;
import java.util.UUID;

/**
 * The single place that decides who may do what. Modules call it before acting; a refusal becomes
 * {@code 403 PERMISSION_DENIED}. Hiding buttons in the UI is a convenience, this is the enforcement.
 *
 * <p>Sales managers have organisation-wide scope over sales records; reps work their own. Accounts and contacts are
 * shared reference data that everyone may read (see docs/architecture.md, "Authorization").
 */
@Component
public class AccessPolicy {

    /** Whether the user may see and manage records owned by other people. */
    public boolean canAccessAllSalesRecords(AuthenticatedUser user) {
        return user.hasRole(Role.ADMIN) || user.hasRole(Role.SALES_MANAGER);
    }

    public boolean canAccessRecordOwnedBy(AuthenticatedUser user, UUID ownerId) {
        return canAccessAllSalesRecords(user) || Objects.equals(user.id(), ownerId);
    }

    public void requireAccessToRecordOwnedBy(AuthenticatedUser user, String recordType, UUID ownerId) {
        if (!canAccessRecordOwnedBy(user, ownerId)) {
            throw new PermissionDeniedException("You don't have access to this %s.".formatted(recordType));
        }
    }

    /** Reps can only own their own work; managers and admins may assign to anyone. */
    public void requireCanAssignTo(AuthenticatedUser user, UUID ownerId) {
        if (!canAccessAllSalesRecords(user) && !Objects.equals(user.id(), ownerId)) {
            throw new PermissionDeniedException("Only managers and admins can assign records to other people.");
        }
    }

    /** Owners edit their own records; managers and admins edit any. */
    public void requireCanEditRecordOwnedBy(AuthenticatedUser user, String recordType, UUID ownerId) {
        if (!canAccessRecordOwnedBy(user, ownerId)) {
            throw new PermissionDeniedException("Only the owner, a manager or an admin can change this %s.".formatted(recordType));
        }
    }

    /** Archiving hides a record from everyone, so it is reserved for managers and admins. */
    public boolean canArchiveSalesRecords(AuthenticatedUser user) {
        return canAccessAllSalesRecords(user);
    }

    public void requireCanArchive(AuthenticatedUser user, String recordType) {
        if (!canArchiveSalesRecords(user)) {
            throw new PermissionDeniedException("Only managers and admins can archive or restore a %s.".formatted(recordType));
        }
    }

    /** Quotas and territories are set by managers and admins. */
    public boolean canManageSalesProfiles(AuthenticatedUser user) {
        return canAccessAllSalesRecords(user);
    }

    public void requireCanManageSalesProfiles(AuthenticatedUser user) {
        if (!canManageSalesProfiles(user)) {
            throw new PermissionDeniedException("Only managers and admins can change sales profiles.");
        }
    }

    public boolean canManageUsers(AuthenticatedUser user) {
        return user.hasRole(Role.ADMIN);
    }

    public void requireCanManageUsers(AuthenticatedUser user) {
        if (!canManageUsers(user)) {
            throw new PermissionDeniedException("Only admins can manage users.");
        }
    }

    public boolean canViewUsers(AuthenticatedUser user) {
        return canAccessAllSalesRecords(user);
    }

    public void requireCanViewUsers(AuthenticatedUser user) {
        if (!canViewUsers(user)) {
            throw new PermissionDeniedException("You don't have access to the user directory.");
        }
    }
}
