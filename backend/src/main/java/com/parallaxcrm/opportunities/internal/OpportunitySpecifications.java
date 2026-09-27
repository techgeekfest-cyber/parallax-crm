package com.parallaxcrm.opportunities.internal;

import com.parallaxcrm.opportunities.OpportunityStage;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

public final class OpportunitySpecifications {

    private OpportunitySpecifications() {
    }

    public static Specification<Opportunity> matching(String query, Collection<OpportunityStage> stages,
            UUID accountId, UUID ownerId, boolean archived) {
        return (root, criteriaQuery, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(archived ? cb.isNotNull(root.get("archivedAt")) : cb.isNull(root.get("archivedAt")));
            if (stages != null && !stages.isEmpty()) {
                predicates.add(root.get("stage").in(stages));
            }
            if (accountId != null) {
                predicates.add(cb.equal(root.get("accountId"), accountId));
            }
            if (ownerId != null) {
                predicates.add(cb.equal(root.get("ownerId"), ownerId));
            }
            String pattern = likePattern(query);
            if (pattern != null) {
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), pattern, '\\'),
                        cb.like(cb.lower(root.get("number")), pattern, '\\')));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    /** A lower-case {@code %…%} LIKE pattern with wildcards escaped (backslash is the escape character), or null. */
    public static String likePattern(String query) {
        if (query == null || query.isBlank()) {
            return null;
        }
        return "%" + query.strip().toLowerCase(Locale.ROOT)
                .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }
}
