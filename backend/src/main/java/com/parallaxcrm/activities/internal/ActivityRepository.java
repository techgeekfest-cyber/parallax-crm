package com.parallaxcrm.activities.internal;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ActivityRepository extends JpaRepository<Activity, UUID> {

    Page<Activity> findByLeadId(UUID leadId, Pageable pageable);

    Page<Activity> findByAccountId(UUID accountId, Pageable pageable);

    Page<Activity> findByContactId(UUID contactId, Pageable pageable);

    Page<Activity> findByOpportunityId(UUID opportunityId, Pageable pageable);
}
