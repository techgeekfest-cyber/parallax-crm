package com.parallaxcrm.opportunities;

import com.parallaxcrm.accounts.AccountService;
import com.parallaxcrm.audit.AuditAction;
import com.parallaxcrm.audit.AuditTrail;
import com.parallaxcrm.identity.AccessPolicy;
import com.parallaxcrm.identity.AuthenticatedUser;
import com.parallaxcrm.identity.CurrentUser;
import com.parallaxcrm.identity.UserDirectory;
import com.parallaxcrm.opportunities.internal.Opportunity;
import com.parallaxcrm.opportunities.internal.OpportunityRepository;
import com.parallaxcrm.opportunities.internal.OpportunitySpecifications;
import com.parallaxcrm.opportunities.internal.StageHistoryEntry;
import com.parallaxcrm.opportunities.internal.StageHistoryRepository;
import com.parallaxcrm.shared.domain.ChangeSet;
import com.parallaxcrm.shared.error.InvalidRequestException;
import com.parallaxcrm.shared.error.PermissionDeniedException;
import com.parallaxcrm.shared.error.RecordNotFoundException;
import com.parallaxcrm.shared.error.StaleVersionException;
import com.parallaxcrm.shared.web.RecordPermissions;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Public API of the opportunities module. Reps see and work only their own opportunities; managers and admins see all.
 * Every stage an opportunity enters is written to its stage history in the same transaction.
 */
@Service
@Transactional(readOnly = true)
public class OpportunityService {

    static final String RECORD_TYPE = "Opportunity";

    private final OpportunityRepository opportunities;
    private final StageHistoryRepository stageHistory;
    private final AccountService accounts;
    private final AuditTrail auditTrail;
    private final CurrentUser currentUser;
    private final AccessPolicy accessPolicy;
    private final UserDirectory userDirectory;

    OpportunityService(OpportunityRepository opportunities, StageHistoryRepository stageHistory,
            AccountService accounts, AuditTrail auditTrail, CurrentUser currentUser, AccessPolicy accessPolicy,
            UserDirectory userDirectory) {
        this.opportunities = opportunities;
        this.stageHistory = stageHistory;
        this.accounts = accounts;
        this.auditTrail = auditTrail;
        this.currentUser = currentUser;
        this.accessPolicy = accessPolicy;
        this.userDirectory = userDirectory;
    }

    @Transactional
    public Opportunity create(OpportunityInput input) {
        AuthenticatedUser actor = currentUser.require();
        UUID ownerId = input.ownerId() != null ? input.ownerId() : actor.id();
        accessPolicy.requireCanAssignTo(actor, ownerId);
        userDirectory.requireAssignable(ownerId, "ownerId");
        accounts.requireActive(input.accountId(), "accountId");

        Opportunity saved = opportunities.saveAndFlush(Opportunity.create(input, ownerId));
        stageHistory.save(new StageHistoryEntry(saved, null, actor.id()));
        Map<String, Object> snapshot = saved.snapshot();
        snapshot.values().removeIf(Objects::isNull);
        snapshot.put("number", saved.getNumber());
        auditTrail.record(AuditAction.CREATE, RECORD_TYPE, saved.getId(), snapshot);
        return saved;
    }

    @Transactional
    public Opportunity update(UUID id, OpportunityInput input, long expectedVersion) {
        AuthenticatedUser actor = currentUser.require();
        Opportunity opportunity = find(id);
        accessPolicy.requireCanEditRecordOwnedBy(actor, "opportunity", opportunity.getOwnerId());
        if (opportunity.getVersion() != expectedVersion) {
            throw new StaleVersionException("opportunity");
        }
        if (opportunity.isArchived()) {
            throw new InvalidRequestException("Restore this opportunity before editing it.");
        }
        UUID ownerId = input.ownerId() != null ? input.ownerId() : opportunity.getOwnerId();
        if (!Objects.equals(ownerId, opportunity.getOwnerId())) {
            accessPolicy.requireCanAssignTo(actor, ownerId);
            userDirectory.requireAssignable(ownerId, "ownerId");
        }
        if (!Objects.equals(input.accountId(), opportunity.getAccountId())) {
            accounts.requireActive(input.accountId(), "accountId");
        }

        Map<String, Object> before = opportunity.snapshot();
        OpportunityStage previousStage = opportunity.getStage();
        opportunity.update(input, ownerId);
        ChangeSet changes = new ChangeSet().diff(before, opportunity.snapshot());
        if (!changes.isEmpty()) {
            opportunities.flush();
            if (opportunity.getStage() != previousStage) {
                stageHistory.save(new StageHistoryEntry(opportunity, previousStage, actor.id()));
            }
            auditTrail.record(AuditAction.UPDATE, RECORD_TYPE, opportunity.getId(), changes.asMap());
        }
        return opportunity;
    }

    public Opportunity get(UUID id) {
        Opportunity opportunity = find(id);
        accessPolicy.requireAccessToRecordOwnedBy(currentUser.require(), "opportunity", opportunity.getOwnerId());
        return opportunity;
    }

    public List<StageHistoryEntry> stageHistory(Opportunity opportunity) {
        return stageHistory.findByOpportunityIdOrderByChangedAtAscIdAsc(opportunity.getId());
    }

    public Page<Opportunity> list(String query, Collection<OpportunityStage> stages, UUID accountId, UUID ownerId,
            boolean archived, Pageable pageable) {
        UUID effectiveOwner = visibleOwner(currentUser.require(), ownerId);
        return opportunities.findAll(
                OpportunitySpecifications.matching(query, stages, accountId, effectiveOwner, archived), pageable);
    }

    /** Pipeline totals over the opportunities the current user can see (reps: their own). */
    public PipelineSummary summary(UUID accountId, UUID ownerId) {
        UUID effectiveOwner = visibleOwner(currentUser.require(), ownerId);
        long openCount = 0;
        long wonCount = 0;
        long lostCount = 0;
        BigDecimal openAmount = BigDecimal.ZERO;
        BigDecimal weighted = BigDecimal.ZERO;
        BigDecimal wonAmount = BigDecimal.ZERO;
        for (var totals : opportunities.totalsByStage(accountId, effectiveOwner)) {
            OpportunityStage stage = OpportunityStage.valueOf(totals.getStage());
            switch (stage) {
                case CLOSED_WON -> {
                    wonCount += totals.getTotal();
                    wonAmount = wonAmount.add(totals.getAmount());
                }
                case CLOSED_LOST -> lostCount += totals.getTotal();
                default -> {
                    openCount += totals.getTotal();
                    openAmount = openAmount.add(totals.getAmount());
                    weighted = weighted.add(totals.getWeighted());
                }
            }
        }
        return new PipelineSummary(openCount, openAmount, weighted.setScale(2, java.math.RoundingMode.HALF_UP),
                wonCount, wonAmount, lostCount);
    }

    @Transactional
    public Opportunity archive(UUID id) {
        accessPolicy.requireCanArchive(currentUser.require(), "opportunity");
        Opportunity opportunity = find(id);
        opportunity.archive();
        opportunities.flush();
        auditTrail.record(AuditAction.ARCHIVE, RECORD_TYPE, id, Map.of("name", opportunity.getName()));
        return opportunity;
    }

    @Transactional
    public Opportunity restore(UUID id) {
        accessPolicy.requireCanArchive(currentUser.require(), "opportunity");
        Opportunity opportunity = find(id);
        opportunity.restore();
        opportunities.flush();
        auditTrail.record(AuditAction.RESTORE, RECORD_TYPE, id, Map.of("name", opportunity.getName()));
        return opportunity;
    }

    public RecordPermissions permissionsFor(Opportunity opportunity) {
        AuthenticatedUser actor = currentUser.require();
        return new RecordPermissions(
                !opportunity.isArchived() && accessPolicy.canAccessRecordOwnedBy(actor, opportunity.getOwnerId()),
                accessPolicy.canArchiveSalesRecords(actor));
    }

    /** For the sales team module. Does not authorise; the caller applies its own policy. */
    public Map<UUID, OwnerPipeline> pipelineByOwner(Collection<UUID> ownerIds, Instant wonSince) {
        if (ownerIds.isEmpty()) {
            return Map.of();
        }
        return opportunities.totalsByOwner(ownerIds, wonSince).stream().collect(Collectors.toMap(
                OpportunityRepository.OwnerTotals::getOwnerId,
                t -> new OwnerPipeline(t.getOpenCount(), t.getOpenAmount(),
                        t.getWeightedAmount().setScale(2, java.math.RoundingMode.HALF_UP), t.getWonSince())));
    }

    /** Reps are limited to their own opportunities; asking for someone else's is refused rather than ignored. */
    private UUID visibleOwner(AuthenticatedUser actor, UUID requestedOwner) {
        if (accessPolicy.canAccessAllSalesRecords(actor)) {
            return requestedOwner;
        }
        if (requestedOwner != null && !requestedOwner.equals(actor.id())) {
            throw new PermissionDeniedException("You can only view your own opportunities.");
        }
        return actor.id();
    }

    private Opportunity find(UUID id) {
        return opportunities.findById(id).orElseThrow(() -> new RecordNotFoundException(RECORD_TYPE, id));
    }
}
