package com.parallaxcrm.identity.internal;

import com.parallaxcrm.identity.Role;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;

public final class UserSpecifications {

    private UserSpecifications() {
    }

    public static Specification<User> matching(String query, Role role, Boolean active) {
        return matching(query, role == null ? null : List.of(role), active);
    }

    public static Specification<User> matching(String query, Collection<Role> roles, Boolean active) {
        return (root, criteriaQuery, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (roles != null && !roles.isEmpty()) {
                predicates.add(root.get("role").in(roles));
            }
            if (active != null) {
                predicates.add(cb.equal(root.get("active"), active));
            }
            if (query != null && !query.isBlank()) {
                String pattern = "%" + query.strip().toLowerCase(Locale.ROOT)
                        .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                var fullName = cb.concat(cb.concat(root.get("firstName"), " "), root.get("lastName"));
                predicates.add(cb.or(
                        cb.like(cb.lower(fullName), pattern, '\\'),
                        cb.like(cb.lower(root.get("email")), pattern, '\\')));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
