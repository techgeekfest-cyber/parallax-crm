package com.parallaxcrm.identity.web;

import com.parallaxcrm.identity.Role;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Full replacement of the editable fields; {@code version} must match the stored record (optimistic locking). */
public record UpdateUserRequest(
        @NotBlank @Size(max = 100) String firstName,
        @NotBlank @Size(max = 100) String lastName,
        @NotNull Role role,
        @NotNull Boolean active,
        @NotNull Long version) {
}
