package com.parallaxcrm.accounts.web;

import com.parallaxcrm.accounts.AccountService;
import com.parallaxcrm.accounts.AccountType;
import com.parallaxcrm.accounts.internal.Account;
import com.parallaxcrm.accounts.internal.EnterpriseAccount;
import com.parallaxcrm.identity.UserDirectory;
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

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/accounts")
@Tag(name = "Accounts")
class AccountController {

    private static final Set<String> SORTABLE = Set.of(
            "name", "industry", "employeeCount", "annualRevenue", "createdAt", "updatedAt", "number");
    private static final Sort DEFAULT_SORT = Sort.by("name").and(Sort.by("id"));

    private final AccountService accounts;
    private final UserDirectory users;

    AccountController(AccountService accounts, UserDirectory users) {
        this.accounts = accounts;
        this.users = users;
    }

    @GetMapping
    @Operation(summary = "List accounts", description = "Every signed-in user can browse accounts.")
    PageResponse<AccountSummaryResponse> list(
            @Parameter(description = "Matches name, website, industry or account number")
            @RequestParam(required = false) String q,
            @RequestParam(required = false) AccountType type,
            @RequestParam(required = false) UUID ownerId,
            @Parameter(description = "true lists archived accounts instead of active ones")
            @RequestParam(defaultValue = "false") boolean archived,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @Parameter(description = "field[,asc|desc]; sortable: name, industry, employeeCount, annualRevenue, createdAt, updatedAt, number")
            @RequestParam(required = false) String sort) {
        Page<Account> result = accounts.list(q, type, ownerId, archived,
                PageRequests.of(page, size, sort, SORTABLE, DEFAULT_SORT));
        var owners = users.summaries(result.map(Account::getOwnerId).getContent());
        return PageResponse.of(result, account -> AccountSummaryResponse.from(account, owners.get(account.getOwnerId())));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get an account")
    AccountResponse get(@PathVariable UUID id) {
        return full(accounts.get(id));
    }

    @PostMapping
    @Operation(summary = "Create an account")
    ResponseEntity<AccountResponse> create(@Valid @RequestBody AccountRequest request) {
        Account account = accounts.create(request.toInput());
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(account.getId()).toUri();
        return ResponseEntity.created(location).body(full(account));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update an account", description = "Owner, managers and admins. Requires the loaded version.")
    AccountResponse update(@PathVariable UUID id, @Valid @RequestBody AccountRequest request) {
        if (request.version() == null) {
            throw new InvalidRequestException("version", "Send the version you are editing.");
        }
        return full(accounts.update(id, request.toInput(), request.version()));
    }

    @PostMapping("/{id}/archive")
    @Operation(summary = "Archive an account", description = "Managers and admins.")
    AccountResponse archive(@PathVariable UUID id) {
        return full(accounts.archive(id));
    }

    @PostMapping("/{id}/restore")
    @Operation(summary = "Restore an archived account", description = "Managers and admins.")
    AccountResponse restore(@PathVariable UUID id) {
        return full(accounts.restore(id));
    }

    private AccountResponse full(Account account) {
        List<UUID> people = new ArrayList<>();
        people.add(account.getOwnerId());
        if (account instanceof EnterpriseAccount enterprise) {
            people.add(enterprise.getAccountManagerId());
        }
        return AccountResponse.from(account, users.summaries(people), accounts.permissionsFor(account));
    }
}
