package com.parallaxcrm.opportunities.web;

import com.parallaxcrm.accounts.AccountRefResponse;
import com.parallaxcrm.accounts.AccountService;
import com.parallaxcrm.identity.UserDirectory;
import com.parallaxcrm.identity.UserSummary;
import com.parallaxcrm.opportunities.OpportunityService;
import com.parallaxcrm.opportunities.PipelineBoard;
import com.parallaxcrm.opportunities.internal.Opportunity;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/pipeline")
@Tag(name = "Opportunities")
class PipelineController {

    private final OpportunityService opportunities;
    private final AccountService accounts;
    private final UserDirectory users;

    PipelineController(OpportunityService opportunities, AccountService accounts, UserDirectory users) {
        this.opportunities = opportunities;
        this.accounts = accounts;
        this.users = users;
    }

    @GetMapping
    @Operation(summary = "The pipeline board",
            description = "One column per stage with its count, amount and weighted amount, plus the cards to show. "
                    + "Covers active opportunities you can see (reps: their own).")
    PipelineResponse board(
            @Parameter(description = "Matches opportunity name or number") @RequestParam(required = false) String q,
            @RequestParam(required = false) UUID accountId,
            @Parameter(description = "Only this owner's opportunities. Reps may only pass their own id.")
            @RequestParam(required = false) UUID ownerId,
            @Parameter(description = "Cards per column, 1–100") @RequestParam(defaultValue = "50") int limit) {
        PipelineBoard board = opportunities.board(q, accountId, ownerId, limit);
        List<Opportunity> cards = board.columns().stream().flatMap(c -> c.opportunities().stream()).toList();
        var accountRefs = accounts.summaries(cards.stream().map(Opportunity::getAccountId).toList());
        var owners = users.summaries(cards.stream().map(Opportunity::getOwnerId).toList());
        return new PipelineResponse(
                board.columns().stream().map(column -> new PipelineColumnResponse(column.stage(), column.count(),
                        column.amount(), column.weightedAmount(), column.opportunities().stream()
                        .map(o -> new PipelineCardResponse(o.getId(), o.getNumber(), o.getName(),
                                AccountRefResponse.from(accountRefs.get(o.getAccountId())), o.getAmount(), o.getStage(),
                                o.getProbability(), o.getCloseDate(), o.getClosedAt(), o.getNextStep(),
                                UserSummary.ref(owners.get(o.getOwnerId())), o.getVersion(),
                                opportunities.allowedStages(o)))
                        .toList()))
                        .toList(),
                PipelineSummaryResponse.from(board.totals()));
    }
}
