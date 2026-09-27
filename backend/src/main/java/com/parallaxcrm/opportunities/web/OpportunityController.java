package com.parallaxcrm.opportunities.web;

import com.parallaxcrm.accounts.AccountRefResponse;
import com.parallaxcrm.accounts.AccountService;
import com.parallaxcrm.identity.UserDirectory;
import com.parallaxcrm.identity.UserSummary;
import com.parallaxcrm.opportunities.OpportunityService;
import com.parallaxcrm.opportunities.OpportunityStage;
import com.parallaxcrm.opportunities.internal.Opportunity;
import com.parallaxcrm.opportunities.internal.StageHistoryEntry;
import com.parallaxcrm.shared.error.InvalidRequestException;
import com.parallaxcrm.shared.paging.PageRequests;
import com.parallaxcrm.shared.paging.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/opportunities")
@Tag(name = "Opportunities")
class OpportunityController {

    private static final Set<String> SORTABLE = Set.of(
            "name", "amount", "probability", "closeDate", "createdAt", "updatedAt", "number");
    private static final Sort DEFAULT_SORT = Sort.by("closeDate").and(Sort.by("id"));

    private final OpportunityService opportunities;
    private final AccountService accounts;
    private final UserDirectory users;

    OpportunityController(OpportunityService opportunities, AccountService accounts, UserDirectory users) {
        this.opportunities = opportunities;
        this.accounts = accounts;
        this.users = users;
    }

    @GetMapping
    @Operation(summary = "List opportunities", description = "Reps see only their own opportunities.")
    PageResponse<OpportunitySummaryResponse> list(
            @Parameter(description = "Matches name or opportunity number") @RequestParam(required = false) String q,
            @RequestParam(required = false) List<OpportunityStage> stage,
            @RequestParam(required = false) UUID accountId,
            @Parameter(description = "Only this owner's opportunities. Reps may only pass their own id.")
            @RequestParam(required = false) UUID ownerId,
            @RequestParam(defaultValue = "false") boolean archived,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @Parameter(description = "field[,asc|desc]; sortable: name, amount, probability, closeDate, createdAt, updatedAt, number")
            @RequestParam(required = false) String sort) {
        Page<Opportunity> result = opportunities.list(q, stage, accountId, ownerId, archived,
                PageRequests.of(page, size, sort, SORTABLE, DEFAULT_SORT));
        var accountRefs = accounts.summaries(result.map(Opportunity::getAccountId).getContent());
        var owners = users.summaries(result.map(Opportunity::getOwnerId).getContent());
        return PageResponse.of(result, o -> new OpportunitySummaryResponse(o.getId(), o.getNumber(), o.getName(),
                AccountRefResponse.from(accountRefs.get(o.getAccountId())), o.getAmount(), o.getStage(),
                o.getProbability(), o.getCloseDate(), UserSummary.ref(owners.get(o.getOwnerId())), o.isArchived(),
                o.getCreatedAt()));
    }

    @GetMapping("/summary")
    @Operation(summary = "Pipeline totals",
            description = "Open, weighted and won totals over the opportunities you can see (reps: their own).")
    PipelineSummaryResponse summary(@RequestParam(required = false) UUID accountId,
            @RequestParam(required = false) UUID ownerId) {
        return PipelineSummaryResponse.from(opportunities.summary(accountId, ownerId));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get an opportunity, with its stage history")
    OpportunityResponse get(@PathVariable UUID id) {
        return full(opportunities.get(id));
    }

    @PostMapping
    @Operation(summary = "Create an opportunity")
    ResponseEntity<OpportunityResponse> create(@Valid @RequestBody OpportunityRequest request) {
        Opportunity opportunity = opportunities.create(request.toInput());
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(opportunity.getId()).toUri();
        return ResponseEntity.created(location).body(full(opportunity));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update an opportunity", description = "Owner, managers and admins. Requires the loaded version.")
    OpportunityResponse update(@PathVariable UUID id, @Valid @RequestBody OpportunityRequest request) {
        if (request.version() == null) {
            throw new InvalidRequestException("version", "Send the version you are editing.");
        }
        return full(opportunities.update(id, request.toInput(), request.version()));
    }

    @PostMapping("/{id}/stage-transitions")
    @Operation(summary = "Move an opportunity to another stage",
            description = "The pipeline workflow: one stage at a time forwards or back, won only from Negotiation, lost "
                    + "from any open stage, closed deals reopen into any open stage. Resets the probability to the "
                    + "stage default and records stage history, an audit event and a timeline activity. "
                    + "409 INVALID_STATE_TRANSITION for a move the workflow doesn't allow, 409 CONFLICT for a stale version.")
    OpportunityResponse transition(@PathVariable UUID id, @Valid @RequestBody StageTransitionRequest request) {
        return full(opportunities.transition(id, request.toStage(), request.version(), request.note()));
    }

    @GetMapping("/{id}/stage-history")
    @Operation(summary = "Every stage the opportunity entered, oldest first")
    List<StageHistoryResponse> stageHistory(@PathVariable UUID id) {
        return historyOf(opportunities.get(id));
    }

    @PostMapping("/{id}/archive")
    @Operation(summary = "Archive an opportunity", description = "Managers and admins.")
    OpportunityResponse archive(@PathVariable UUID id) {
        return full(opportunities.archive(id));
    }

    @PostMapping("/{id}/restore")
    @Operation(summary = "Restore an archived opportunity", description = "Managers and admins.")
    OpportunityResponse restore(@PathVariable UUID id) {
        return full(opportunities.restore(id));
    }

    private OpportunityResponse full(Opportunity o) {
        var userRefs = users.summaries(List.of(o.getOwnerId()));
        var account = accounts.summaries(List.of(o.getAccountId())).get(o.getAccountId());
        return new OpportunityResponse(o.getId(), o.getNumber(), o.getName(), AccountRefResponse.from(account),
                o.getAmount(), o.getStage(), o.getProbability(), o.weightedAmount(), o.getCloseDate(), o.getType(),
                o.getLeadSource(), o.getDescription(), o.getNextStep(), UserSummary.ref(userRefs.get(o.getOwnerId())),
                o.getClosedAt(), historyOf(o), opportunities.allowedStages(o),
                o.isArchived(), o.getArchivedAt(), o.getCreatedAt(), o.getUpdatedAt(), o.getVersion(),
                opportunities.permissionsFor(o));
    }

    private List<StageHistoryResponse> historyOf(Opportunity o) {
        List<StageHistoryEntry> history = opportunities.stageHistory(o);
        var people = users.summaries(history.stream().map(StageHistoryEntry::getChangedBy).toList());
        return history.stream().map(h -> new StageHistoryResponse(h.getFromStage(), h.getToStage(), h.getAmount(),
                h.getProbability(), UserSummary.ref(people.get(h.getChangedBy())), h.getChangedAt())).toList();
    }
}
