package com.parallaxcrm.contacts;

import com.parallaxcrm.shared.domain.Address;

import java.util.UUID;

/** Create or fully update a contact. {@code ownerId} null means "me" on create and "unchanged" on update. */
public record ContactInput(
        UUID accountId,
        String firstName,
        String lastName,
        String email,
        String phone,
        String title,
        String department,
        boolean primary,
        Address mailingAddress,
        UUID ownerId) {
}
