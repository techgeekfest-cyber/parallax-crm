package com.parallaxcrm.accounts.internal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface AccountRepository extends JpaRepository<Account, UUID>, JpaSpecificationExecutor<Account> {

    boolean existsByNameIgnoreCaseAndArchivedAtIsNull(String name);

    boolean existsByNameIgnoreCaseAndArchivedAtIsNullAndIdNot(String name, UUID id);

    @Query("""
            select a.ownerId as ownerId, count(a) as total from Account a
            where a.archivedAt is null and a.ownerId in :ownerIds group by a.ownerId""")
    List<OwnerCount> countActiveByOwner(@Param("ownerIds") Collection<UUID> ownerIds);

    interface OwnerCount {
        UUID getOwnerId();

        long getTotal();
    }
}
