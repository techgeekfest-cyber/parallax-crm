package com.parallaxcrm.opportunities;

import com.parallaxcrm.accounts.AccountService;
import com.parallaxcrm.activities.ActivityLinks;
import com.parallaxcrm.activities.ActivityLog;
import com.parallaxcrm.activities.ActivityType;
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
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.EnumMap;
import java.util.LinkedHashMap;
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
    private final ActivityLog activityLog;

    OpportunityService(OpportunityRepository opportunities, StageHistoryRepository stageHistory,
            AccountService accounts, AuditTrail auditTrail, CurrentUser currentUser, AccessPolicy accessPolicy,
            UserDirectory userDirectory, ActivityLog activityLog) {
        this.opportunities = opportunities;
        this.stageHistory = stageHistory;
        this.accounts = accounts;
        this.auditTrail = auditTrail;
        this.currentUser = currentUser;
        this.accessPolicy = accessPolicy;
        this.userDirectory = userDirectory;
        this.activityLog = activityLog;
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

    /**
     * For lead conversion: creates the opportunity under the same rules as {@link #create}, as part of the caller's
     * transaction, and returns the public summary other modules may use.
     */
    @Transactional
    public OpportunitySummary createFromLead(OpportunityInput input) {
        if (input.stage() != null && input.stage().isClosed()) {
            throw new InvalidRequestException("stage", "A converted lead starts an open opportunity.");
        }
        Opportunity saved = create(input);
        return new OpportunitySummary(saved.getId(), saved.getNumber(), saved.getName(), saved.getStage(),
                saved.getOwnerId());
    }

    /**
     * Moves an opportunity to another stage through the pipeline workflow. In one transaction: the transition is
     * validated, the probability resets to the stage default, and the stage history, audit event and timeline
     * activity are written. A stale {@code expectedVersion} is a conflict, never a silent overwrite.
     */
    @Transactional
    public Opportunity transition(UUID id, OpportunityStage toStage, long expectedVersion, String note) {
        AuthenticatedUser actor = currentUser.require();
        Opportunity opportunity = find(id);
        accessPolicy.requireCanEditRecordOwnedBy(actor, "opportunity", opportunity.getOwnerId());
        if (opportunity.getVersion() != expectedVersion) {
            throw new StaleVersionException("opportunity");
        }
        if (opportunity.isArchived()) {
            throw new InvalidRequestException("Restore this opportunity before changing its stage.");
        }

        OpportunityStage fromStage = opportunity.getStage();
        int fromProbability = opportunity.getProbability();
        opportunity.transitionTo(toStage);
        opportunities.flush();
        stageHistory.save(new StageHistoryEntry(opportunity, fromStage, actor.id()));

        Map<String, Object> changes = new LinkedHashMap<>();
        changes.put("stage", Map.of("from", fromStage, "to", opportunity.getStage()));
        if (fromProbability != opportunity.getProbability()) {
            changes.put("probability", Map.of("from", fromProbability, "to", opportunity.getProbability()));
        }
        String cleanNote = note == null || note.isBlank() ? null : note.strip();
        if (cleanNote != null) {
            changes.put("note", cleanNote);
        }
        auditTrail.record(AuditAction.STAGE_CHANGE, RECORD_TYPE, id, changes);
        activityLog.record(ActivityType.STAGE_CHANGE, stageSubject(fromStage, opportunity.getStage()), cleanNote,
                ActivityLinks.opportunity(id));
        return opportunity;
    }

    private static String stageSubject(OpportunityStage from, OpportunityStage to) {
        if (to == OpportunityStage.CLOSED_WON) {
            return "Closed won (from %s)".formatted(from.label());
        }
        if (to == OpportunityStage.CLOSED_LOST) {
            return "Closed lost (from %s)".formatted(from.label());
        }
        if (from.isClosed()) {
            return "Reopened from %s into %s".formatted(from.label(), to.label());
        }
        return "Stage changed from %s to %s".formatted(from.label(), to.label());
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
        UUID previousOwner = opportunity.getOwnerId();
        opportunity.update(input, ownerId);
        ChangeSet changes = new ChangeSet().diff(before, opportunity.snapshot());
        if (!changes.isEmpty()) {
            opportunities.flush();
            auditTrail.record(AuditAction.UPDATE, RECORD_TYPE, opportunity.getId(), changes.asMap());
        }
        if (!Objects.equals(previousOwner, opportunity.getOwnerId())) {
            recordAssignment(opportunity, previousOwner);
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

    /** The stages this user may move the opportunity to right now (none if they can't edit it or it is archived). */
    public List<OpportunityStage> allowedStages(Opportunity opportunity) {
        AuthenticatedUser actor = currentUser.require();
        if (opportunity.isArchived() || !accessPolicy.canAccessRecordOwnedBy(actor, opportunity.getOwnerId())) {
            return List.of();
        }
        return List.copyOf(opportunity.getStage().allowedTransitions());
    }

    /**
     * The Kanban board: every stage with its full count and totals, and up to {@code limit} cards — open stages by
     * expected close date, closed stages most recently closed first. Covers what the viewer can see (reps: their own).
     */
    public PipelineBoard board(String query, UUID accountId, UUID ownerId, int limit) {
        if (limit < 1 || limit > 100) {
            throw new InvalidRequestException("limit", "Limit must be between 1 and 100.");
        }
        UUID effectiveOwner = visibleOwner(currentUser.require(), ownerId);
        List<OpportunityRepository.StageTotals> rows =
                opportunities.totalsByStage(accountId, effectiveOwner, OpportunitySpecifications.likePattern(query));
        Map<OpportunityStage, OpportunityRepository.StageTotals> totals = new EnumMap<>(OpportunityStage.class);
        rows.forEach(row -> totals.put(OpportunityStage.valueOf(row.getStage()), row));
        List<PipelineBoard.Column> columns = new java.util.ArrayList<>();
        for (OpportunityStage stage : OpportunityStage.values()) {
            Sort order = stage.isClosed()
                    ? Sort.by(Sort.Direction.DESC, "closedAt").and(Sort.by("id"))
                    : Sort.by("closeDate").and(Sort.by("id"));
            Page<Opportunity> cards = opportunities.findAll(
                    OpportunitySpecifications.matching(query, List.of(stage), accountId, effectiveOwner, false),
                    PageRequest.of(0, limit, order));
            var stageTotals = totals.get(stage);
            columns.add(new PipelineBoard.Column(stage,
                    stageTotals == null ? 0 : stageTotals.getTotal(),
                    stageTotals == null ? BigDecimal.ZERO : stageTotals.getAmount(),
                    stageTotals == null ? BigDecimal.ZERO
                            : stageTotals.getWeighted().setScale(2, java.math.RoundingMode.HALF_UP),
                    cards.getContent()));
        }
        return new PipelineBoard(columns, summarise(rows));
    }

    private void recordAssignment(Opportunity opportunity, UUID previousOwner) {
        var people = userDirectory.summaries(java.util.Arrays.asList(previousOwner, opportunity.getOwnerId()));
        String from = previousOwner == null || people.get(previousOwner) == null ? "nobody"
                : people.get(previousOwner).fullName();
        String to = people.get(opportunity.getOwnerId()) == null ? "nobody" : people.get(opportunity.getOwnerId()).fullName();
        activityLog.record(ActivityType.ASSIGNMENT, "Reassigned from %s to %s".formatted(from, to), null,
                ActivityLinks.opportunity(opportunity.getId()));
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
        return summarise(opportunities.totalsByStage(accountId, effectiveOwner, null));
    }

    private static PipelineSummary summarise(Collection<OpportunityRepository.StageTotals> stageTotals) {
        long openCount = 0;
        long wonCount = 0;
        long lostCount = 0;
        BigDecimal openAmount = BigDecimal.ZERO;
        BigDecimal weighted = BigDecimal.ZERO;
        BigDecimal wonAmount = BigDecimal.ZERO;
        for (var totals : stageTotals) {
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

    /** For other modules, to show links to opportunities. Does not authorise; opening the link does. */
    public Map<UUID, OpportunitySummary> summaries(Collection<UUID> ids) {
        var distinct = ids.stream().filter(Objects::nonNull).collect(Collectors.toSet());
        if (distinct.isEmpty()) {
            return Map.of();
        }
        return opportunities.findAllById(distinct).stream().collect(Collectors.toMap(Opportunity::getId,
                o -> new OpportunitySummary(o.getId(), o.getNumber(), o.getName(), o.getStage(), o.getOwnerId())));
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
