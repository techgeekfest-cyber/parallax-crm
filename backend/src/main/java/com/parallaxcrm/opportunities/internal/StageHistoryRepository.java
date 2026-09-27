package com.parallaxcrm.opportunities.internal;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface StageHistoryRepository extends JpaRepository<StageHistoryEntry, UUID> {

    List<StageHistoryEntry> findByOpportunityIdOrderByChangedAtAscIdAsc(UUID opportunityId);
}
