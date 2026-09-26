package com.parallaxcrm.identity.web;

import com.parallaxcrm.identity.Role;
import com.parallaxcrm.identity.internal.User;
import com.parallaxcrm.identity.internal.UserAdministration;
import com.parallaxcrm.identity.internal.UserAdministration.NewUser;
import com.parallaxcrm.identity.internal.UserAdministration.UserChanges;
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
@RequestMapping("/api/v1/users")
@Tag(name = "Users")
class UserController {

    private static final Set<String> SORTABLE = Set.of("lastName", "email", "role", "createdAt", "lastLoginAt");
    private static final Sort DEFAULT_SORT = Sort.by("firstName", "lastName", "id");

    private final UserAdministration users;

    UserController(UserAdministration users) {
        this.users = users;
    }

    @GetMapping
    @Operation(summary = "List users", description = "Admins and sales managers.")
    PageResponse<UserResponse> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Role role,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) String sort) {
        return PageResponse.of(users.list(q, role, active, PageRequests.of(page, size, sort, SORTABLE, DEFAULT_SORT)),
                UserResponse::from);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a user", description = "Admins and sales managers.")
    UserResponse get(@PathVariable UUID id) {
        return UserResponse.from(users.get(id));
    }

    @PostMapping
    @Operation(summary = "Create a user", description = "Admins only. The initial password is shared out of band.")
    ResponseEntity<UserResponse> create(@Valid @RequestBody CreateUserRequest request) {
        User user = users.create(new NewUser(request.email(), request.firstName(), request.lastName(), request.role(),
                request.password()));
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(user.getId()).toUri();
        return ResponseEntity.created(location).body(UserResponse.from(user));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a user",
            description = "Admins only. Changing role or deactivating ends the user's sessions.")
    UserResponse update(@PathVariable UUID id, @Valid @RequestBody UpdateUserRequest request) {
        return UserResponse.from(users.update(id, new UserChanges(request.firstName(), request.lastName(),
                request.role(), request.active(), request.version())));
    }
}
