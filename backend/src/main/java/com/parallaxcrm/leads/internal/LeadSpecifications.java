package com.parallaxcrm.leads.internal;

import com.parallaxcrm.leads.LeadStatus;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;

/** Translates list filters into a JPA criteria query. Archived leads are always excluded. */
public final class LeadSpecifications {

    private LeadSpecifications() {
    }

    public static Specification<Lead> matching(String query, Collection<LeadStatus> statuses) {
        return (root, criteriaQuery, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isNull(root.get("archivedAt")));
            if (statuses != null && !statuses.isEmpty()) {
                predicates.add(root.get("status").in(statuses));
            }
            if (query != null && !query.isBlank()) {
                String pattern = "%" + escapeLike(query.strip().toLowerCase(Locale.ROOT)) + "%";
                var fullName = cb.concat(cb.concat(root.get("firstName"), " "), root.get("lastName"));
                predicates.add(cb.or(
                        cb.like(cb.lower(fullName), pattern, '\\'),
                        cb.like(cb.lower(root.get("company")), pattern, '\\'),
                        cb.like(cb.lower(root.get("email")), pattern, '\\'),
                        cb.like(cb.lower(root.get("number")), pattern, '\\')));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
