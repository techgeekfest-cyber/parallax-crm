package com.parallaxcrm.opportunities.internal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface OpportunityRepository extends JpaRepository<Opportunity, UUID>, JpaSpecificationExecutor<Opportunity> {

    /**
     * Totals per stage for active opportunities, optionally limited to one account, one owner and/or a name/number
     * search ({@code pattern} from {@link OpportunitySpecifications#likePattern}).
     */
    @Query(nativeQuery = true, value = """
            select stage as stage, count(*) as total, coalesce(sum(amount), 0) as amount,
                   coalesce(sum(amount * probability / 100.0), 0) as weighted
            from opportunities
            where archived_at is null
              and (cast(:accountId as uuid) is null or account_id = cast(:accountId as uuid))
              and (cast(:ownerId as uuid) is null or owner_id = cast(:ownerId as uuid))
              and (cast(:pattern as text) is null
                   or lower(name) like cast(:pattern as text) escape '\\'
                   or lower(number) like cast(:pattern as text) escape '\\')
            group by stage""")
    List<StageTotals> totalsByStage(@Param("accountId") UUID accountId, @Param("ownerId") UUID ownerId,
            @Param("pattern") String pattern);

    @Query(nativeQuery = true, value = """
            select owner_id as ownerId,
                   count(*) filter (where stage not in ('CLOSED_WON', 'CLOSED_LOST')) as openCount,
                   coalesce(sum(amount) filter (where stage not in ('CLOSED_WON', 'CLOSED_LOST')), 0) as openAmount,
                   coalesce(sum(amount * probability / 100.0) filter (where stage not in ('CLOSED_WON', 'CLOSED_LOST')), 0)
                       as weightedAmount,
                   coalesce(sum(amount) filter (where stage = 'CLOSED_WON' and closed_at >= :since), 0) as wonSince
            from opportunities
            where archived_at is null and owner_id in (:ownerIds)
            group by owner_id""")
    List<OwnerTotals> totalsByOwner(@Param("ownerIds") Collection<UUID> ownerIds, @Param("since") Instant since);

    interface StageTotals {
        String getStage();

        long getTotal();

        BigDecimal getAmount();

        BigDecimal getWeighted();
    }

    interface OwnerTotals {
        UUID getOwnerId();

        long getOpenCount();

        BigDecimal getOpenAmount();

        BigDecimal getWeightedAmount();

        BigDecimal getWonSince();
    }
}
