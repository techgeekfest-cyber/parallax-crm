package com.parallaxcrm.salesteam.web;

import com.parallaxcrm.identity.AccessPolicy;
import com.parallaxcrm.identity.CurrentUser;
import com.parallaxcrm.salesteam.SalesRep;
import com.parallaxcrm.salesteam.SalesTeamService;
import com.parallaxcrm.shared.paging.PageRequests;
import com.parallaxcrm.shared.paging.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
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

import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/sales-reps")
@Tag(name = "Sales reps")
class SalesRepController {

    private static final Set<String> SORTABLE = Set.of("lastName", "email", "createdAt");
    private static final Sort DEFAULT_SORT = Sort.by("firstName", "lastName", "id");

    private final SalesTeamService salesTeam;
    private final CurrentUser currentUser;
    private final AccessPolicy accessPolicy;

    SalesRepController(SalesTeamService salesTeam, CurrentUser currentUser, AccessPolicy accessPolicy) {
        this.salesTeam = salesTeam;
        this.currentUser = currentUser;
        this.accessPolicy = accessPolicy;
    }

    @GetMapping
    @Operation(summary = "List sales reps with performance figures",
            description = "Managers and admins see the whole team; reps see only themselves.")
    PageResponse<SalesRepResponse> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) String sort) {
        boolean canEdit = canEdit();
        return PageResponse.of(salesTeam.list(q, active, PageRequests.of(page, size, sort, SORTABLE, DEFAULT_SORT)),
                rep -> SalesRepResponse.from(rep, canEdit));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a sales rep", description = "Reps may only open their own profile.")
    SalesRepResponse get(@PathVariable UUID id) {
        return SalesRepResponse.from(salesTeam.get(id), canEdit());
    }

    @PostMapping
    @Operation(summary = "Create a sales rep", description = "Admins only. Creates the sign-in account and profile.")
    ResponseEntity<SalesRepResponse> create(@Valid @RequestBody CreateSalesRepRequest request) {
        SalesRep rep = salesTeam.create(request.email(), request.firstName(), request.lastName(), request.role(),
                request.password(), request.profile());
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(rep.user().id()).toUri();
        return ResponseEntity.created(location).body(SalesRepResponse.from(rep, canEdit()));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a sales profile", description = "Managers and admins: title, territory, quota…")
    SalesRepResponse update(@PathVariable UUID id, @Valid @RequestBody SalesProfileRequest request) {
        return SalesRepResponse.from(salesTeam.updateProfile(id, request.toInput(), request.version()), canEdit());
    }

    private boolean canEdit() {
        return accessPolicy.canManageSalesProfiles(currentUser.require());
    }
}
