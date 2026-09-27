package com.parallaxcrm.contacts.web;

import com.parallaxcrm.contacts.ContactInput;
import com.parallaxcrm.shared.web.AddressDto;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record ContactRequest(
        @NotNull UUID accountId,
        @NotBlank @Size(max = 100) String firstName,
        @NotBlank @Size(max = 100) String lastName,
        @Email @Size(max = 320) String email,
        @Size(max = 40) String phone,
        @Size(max = 120) String title,
        @Size(max = 120) String department,
        @Schema(description = "Making a contact primary demotes the account's current primary contact.")
        Boolean primary,
        @Valid AddressDto mailingAddress,
        @Schema(description = "Owner; defaults to you on create and is unchanged on update when omitted.")
        UUID ownerId,
        @Schema(description = "Required on update (optimistic locking).")
        Long version) {

    ContactInput toInput() {
        return new ContactInput(accountId, firstName, lastName, email, phone, title, department,
                Boolean.TRUE.equals(primary), AddressDto.toAddress(mailingAddress), ownerId);
    }
}
