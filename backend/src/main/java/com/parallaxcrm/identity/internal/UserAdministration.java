package com.parallaxcrm.identity.internal;

import com.parallaxcrm.audit.AuditAction;
import com.parallaxcrm.audit.AuditTrail;
import com.parallaxcrm.identity.AccessPolicy;
import com.parallaxcrm.identity.AuthenticatedUser;
import com.parallaxcrm.identity.CurrentUser;
import com.parallaxcrm.identity.Role;
import com.parallaxcrm.shared.error.DuplicateRecordException;
import com.parallaxcrm.shared.error.InvalidRequestException;
import com.parallaxcrm.shared.error.RecordNotFoundException;
import com.parallaxcrm.shared.error.StaleVersionException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/** Admin-only management of user accounts. Managers may read the directory to assign work. */
@Service
@Transactional(readOnly = true)
public class UserAdministration {

    static final String RECORD_TYPE = "User";

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final CurrentUser currentUser;
    private final AccessPolicy accessPolicy;
    private final SessionRevoker sessionRevoker;
    private final AuditTrail auditTrail;

    UserAdministration(UserRepository users, PasswordEncoder passwordEncoder, CurrentUser currentUser,
            AccessPolicy accessPolicy, SessionRevoker sessionRevoker, AuditTrail auditTrail) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.currentUser = currentUser;
        this.accessPolicy = accessPolicy;
        this.sessionRevoker = sessionRevoker;
        this.auditTrail = auditTrail;
    }

    public record NewUser(String email, String firstName, String lastName, Role role, String password) {
    }

    public record UserChanges(String firstName, String lastName, Role role, boolean active, long version) {
    }

    public Page<User> list(String query, Role role, Boolean active, Pageable pageable) {
        accessPolicy.requireCanViewUsers(currentUser.require());
        return users.findAll(UserSpecifications.matching(query, role, active), pageable);
    }

    public User get(UUID id) {
        accessPolicy.requireCanViewUsers(currentUser.require());
        return find(id);
    }

    @Transactional
    public User create(NewUser input) {
        accessPolicy.requireCanManageUsers(currentUser.require());
        String email = User.normaliseEmail(input.email());
        if (users.existsByEmailIgnoreCase(email)) {
            throw new DuplicateRecordException("user", "email", email);
        }
        PasswordPolicy.validate("password", input.password());

        User user = users.saveAndFlush(User.create(email, input.firstName(), input.lastName(), input.role(),
                passwordEncoder.encode(input.password())));
        auditTrail.record(AuditAction.CREATE, RECORD_TYPE, user.getId(), Map.of(
                "email", user.getEmail(), "name", user.fullName(), "role", user.getRole(), "active", true));
        return user;
    }

    @Transactional
    public User update(UUID id, UserChanges changes) {
        AuthenticatedUser actor = currentUser.require();
        accessPolicy.requireCanManageUsers(actor);
        User user = find(id);
        if (user.getVersion() != changes.version()) {
            throw new StaleVersionException("user");
        }
        boolean self = user.getId().equals(actor.id());
        if (self && changes.role() != user.getRole()) {
            throw new InvalidRequestException("role", "You can't change your own role.");
        }
        if (self && !changes.active()) {
            throw new InvalidRequestException("active", "You can't deactivate your own account.");
        }

        Map<String, Object> diff = new LinkedHashMap<>();
        track(diff, "firstName", user.getFirstName(), changes.firstName() == null ? null : changes.firstName().strip());
        track(diff, "lastName", user.getLastName(), changes.lastName() == null ? null : changes.lastName().strip());
        track(diff, "role", user.getRole(), changes.role());
        track(diff, "active", user.isActive(), changes.active());

        user.rename(changes.firstName(), changes.lastName());
        user.changeRole(changes.role());
        if (changes.active()) {
            user.activate();
        } else {
            user.deactivate();
        }

        if (!diff.isEmpty()) {
            users.flush();
            auditTrail.record(AuditAction.UPDATE, RECORD_TYPE, user.getId(), diff);
        }
        // Access is re-evaluated on every request, but ending sessions makes the change unmistakable to the user.
        if (diff.containsKey("role") || diff.containsKey("active")) {
            sessionRevoker.revokeAll(user.getId());
        }
        return user;
    }

    private User find(UUID id) {
        return users.findById(id).orElseThrow(() -> new RecordNotFoundException(RECORD_TYPE, id));
    }

    private static void track(Map<String, Object> diff, String field, Object from, Object to) {
        if (!Objects.equals(from, to)) {
            Map<String, Object> change = new LinkedHashMap<>();
            change.put("from", from);
            change.put("to", to);
            diff.put(field, change);
        }
    }
}
