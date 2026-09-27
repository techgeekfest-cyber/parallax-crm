package com.parallaxcrm.leads.internal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface LeadRepository extends JpaRepository<Lead, UUID>, JpaSpecificationExecutor<Lead> {

    boolean existsByEmailIgnoreCaseAndArchivedAtIsNull(String email);

    @Query("""
            select l.ownerId as ownerId, count(l) as total from Lead l
            where l.archivedAt is null and l.ownerId in :ownerIds
              and l.status in (com.parallaxcrm.leads.LeadStatus.NEW, com.parallaxcrm.leads.LeadStatus.CONTACTED,
                               com.parallaxcrm.leads.LeadStatus.QUALIFIED)
            group by l.ownerId""")
    List<OwnerCount> countOpenByOwner(@Param("ownerIds") Collection<UUID> ownerIds);

    interface OwnerCount {
        UUID getOwnerId();

        long getTotal();
    }
}
