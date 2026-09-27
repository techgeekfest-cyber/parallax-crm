package com.parallaxcrm.contacts.web;

import com.parallaxcrm.accounts.AccountService;
import com.parallaxcrm.contacts.ContactService;
import com.parallaxcrm.contacts.internal.Contact;
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

import java.util.List;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/contacts")
@Tag(name = "Contacts")
class ContactController {

    private static final Set<String> SORTABLE = Set.of("lastName", "title", "createdAt", "updatedAt", "number");
    private static final Sort DEFAULT_SORT = Sort.by("lastName", "firstName", "id");

    private final ContactService contacts;
    private final AccountService accounts;
    private final UserDirectory users;

    ContactController(ContactService contacts, AccountService accounts, UserDirectory users) {
        this.contacts = contacts;
        this.accounts = accounts;
        this.users = users;
    }

    @GetMapping
    @Operation(summary = "List contacts", description = "Every signed-in user can browse contacts.")
    PageResponse<ContactSummaryResponse> list(
            @Parameter(description = "Matches name, email, title or contact number")
            @RequestParam(required = false) String q,
            @RequestParam(required = false) UUID accountId,
            @RequestParam(required = false) UUID ownerId,
            @RequestParam(defaultValue = "false") boolean archived,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @Parameter(description = "field[,asc|desc]; sortable: lastName, title, createdAt, updatedAt, number")
            @RequestParam(required = false) String sort) {
        Page<Contact> result = contacts.list(q, accountId, ownerId, archived,
                PageRequests.of(page, size, sort, SORTABLE, DEFAULT_SORT));
        var accountRefs = accounts.summaries(result.map(Contact::getAccountId).getContent());
        var owners = users.summaries(result.map(Contact::getOwnerId).getContent());
        return PageResponse.of(result, contact -> ContactSummaryResponse.from(contact,
                accountRefs.get(contact.getAccountId()), owners.get(contact.getOwnerId())));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a contact")
    ContactResponse get(@PathVariable UUID id) {
        return full(contacts.get(id));
    }

    @PostMapping
    @Operation(summary = "Create a contact")
    ResponseEntity<ContactResponse> create(@Valid @RequestBody ContactRequest request) {
        Contact contact = contacts.create(request.toInput());
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(contact.getId()).toUri();
        return ResponseEntity.created(location).body(full(contact));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a contact", description = "Owner, managers and admins. Requires the loaded version.")
    ContactResponse update(@PathVariable UUID id, @Valid @RequestBody ContactRequest request) {
        if (request.version() == null) {
            throw new InvalidRequestException("version", "Send the version you are editing.");
        }
        return full(contacts.update(id, request.toInput(), request.version()));
    }

    @PostMapping("/{id}/archive")
    @Operation(summary = "Archive a contact", description = "Managers and admins. An archived contact stops being primary.")
    ContactResponse archive(@PathVariable UUID id) {
        return full(contacts.archive(id));
    }

    @PostMapping("/{id}/restore")
    @Operation(summary = "Restore an archived contact", description = "Managers and admins.")
    ContactResponse restore(@PathVariable UUID id) {
        return full(contacts.restore(id));
    }

    private ContactResponse full(Contact contact) {
        var account = accounts.summaries(List.of(contact.getAccountId())).get(contact.getAccountId());
        var owner = contact.getOwnerId() == null ? null
                : users.summaries(List.of(contact.getOwnerId())).get(contact.getOwnerId());
        return ContactResponse.from(contact, account, owner, contacts.permissionsFor(contact));
    }
}
