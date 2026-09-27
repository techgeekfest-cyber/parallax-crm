package com.parallaxcrm.identity;

import com.parallaxcrm.identity.internal.User;
import com.parallaxcrm.identity.internal.UserRepository;
import com.parallaxcrm.identity.internal.UserSpecifications;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import com.parallaxcrm.shared.error.InvalidRequestException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.EnumSet;
import java.util.Optional;
import java.util.Set;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Read-only lookups of users for other modules. */
@Component
@Transactional(readOnly = true)
public class UserDirectory {

    private final UserRepository users;

    UserDirectory(UserRepository users) {
        this.users = users;
    }

    /** Batch lookup, so listing a page of records costs one query for all owners. */
    public Map<UUID, UserSummary> summaries(Collection<UUID> ids) {
        var distinct = ids.stream().filter(Objects::nonNull).collect(Collectors.toSet());
        if (distinct.isEmpty()) {
            return Map.of();
        }
        return users.findAllById(distinct).stream()
                .map(User::toSummary)
                .collect(Collectors.toMap(UserSummary::id, Function.identity()));
    }

    /** People who carry a quota: sales reps and sales managers. */
    public static final Set<Role> SALES_ROLES = EnumSet.of(Role.SALES_REP, Role.SALES_MANAGER);

    public Page<DirectoryEntry> salesPeople(String query, Boolean active, Pageable pageable) {
        return users.findAll(UserSpecifications.matching(query, SALES_ROLES, active), pageable).map(User::toDirectoryEntry);
    }

    public Optional<DirectoryEntry> find(UUID id) {
        return users.findById(id).map(User::toDirectoryEntry);
    }

    /** Records can only be assigned to active users. */
    public void requireAssignable(UUID userId, String field) {
        boolean assignable = users.findById(userId).map(User::isActive).orElse(false);
        if (!assignable) {
            throw new InvalidRequestException(field, "Choose an active user.");
        }
    }
}
