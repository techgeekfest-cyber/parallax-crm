package com.parallaxcrm.leads.web;

import com.parallaxcrm.identity.UserDirectory;
import com.parallaxcrm.identity.UserSummary;
import com.parallaxcrm.leads.LeadService;
import com.parallaxcrm.leads.LeadStatus;
import com.parallaxcrm.leads.internal.Lead;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/leads")
@Tag(name = "Leads")
class LeadController {

    private static final Set<String> SORTABLE = Set.of(
            "createdAt", "updatedAt", "lastName", "company", "status", "estimatedValue", "number");
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by("id"));

    private final LeadService leads;
    private final UserDirectory users;

    LeadController(LeadService leads, UserDirectory users) {
        this.leads = leads;
        this.users = users;
    }

    @GetMapping
    @Operation(summary = "List leads", description = "Paginated, searchable list of active (non-archived) leads.")
    PageResponse<LeadSummaryResponse> list(
            @Parameter(description = "Matches name, company, email or lead number") @RequestParam(required = false) String q,
            @RequestParam(required = false) List<LeadStatus> status,
            @Parameter(description = "Only leads owned by this user. Reps may only pass their own id.")
            @RequestParam(required = false) UUID ownerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @Parameter(description = "field[,asc|desc]; sortable: createdAt, updatedAt, lastName, company, status, estimatedValue, number")
            @RequestParam(required = false) String sort) {
        var pageable = PageRequests.of(page, size, sort, SORTABLE, DEFAULT_SORT);
        Page<Lead> result = leads.list(q, status, ownerId, pageable);
        Map<UUID, UserSummary> owners = users.summaries(result.map(Lead::getOwnerId).getContent());
        return PageResponse.of(result, lead -> LeadSummaryResponse.from(lead, owners.get(lead.getOwnerId())));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a lead")
    LeadResponse get(@PathVariable UUID id) {
        return withOwner(leads.get(id));
    }

    @PostMapping
    @Operation(summary = "Create a lead")
    ResponseEntity<LeadResponse> create(@Valid @RequestBody CreateLeadRequest request) {
        Lead lead = leads.create(request.toNewLead());
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(lead.getId()).toUri();
        return ResponseEntity.created(location).body(withOwner(lead));
    }

    private LeadResponse withOwner(Lead lead) {
        UserSummary owner = lead.getOwnerId() == null ? null : users.summaries(List.of(lead.getOwnerId())).get(lead.getOwnerId());
        return LeadResponse.from(lead, owner);
    }
}
