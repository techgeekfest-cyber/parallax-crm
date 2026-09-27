package com.parallaxcrm.accounts.internal;

import com.parallaxcrm.accounts.AccountType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

public final class AccountSpecifications {

    private AccountSpecifications() {
    }

    public static Specification<Account> matching(String query, AccountType type, UUID ownerId, boolean archived) {
        return (root, criteriaQuery, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(archived ? cb.isNotNull(root.get("archivedAt")) : cb.isNull(root.get("archivedAt")));
            if (type != null) {
                predicates.add(cb.equal(root.type(), switch (type) {
                    case ENTERPRISE -> EnterpriseAccount.class;
                    case SMB -> SmbAccount.class;
                    case STARTUP -> StartupAccount.class;
                }));
            }
            if (ownerId != null) {
                predicates.add(cb.equal(root.get("ownerId"), ownerId));
            }
            if (query != null && !query.isBlank()) {
                String pattern = "%" + query.strip().toLowerCase(Locale.ROOT)
                        .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), pattern, '\\'),
                        cb.like(cb.lower(root.get("website")), pattern, '\\'),
                        cb.like(cb.lower(root.get("industry")), pattern, '\\'),
                        cb.like(cb.lower(root.get("number")), pattern, '\\')));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
