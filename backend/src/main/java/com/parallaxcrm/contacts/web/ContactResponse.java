package com.parallaxcrm.contacts.web;

import com.parallaxcrm.accounts.AccountRefResponse;
import com.parallaxcrm.accounts.AccountSummary;
import com.parallaxcrm.contacts.internal.Contact;
import com.parallaxcrm.identity.UserSummary;
import com.parallaxcrm.shared.web.AddressDto;
import com.parallaxcrm.shared.web.RecordPermissions;
import com.parallaxcrm.shared.web.UserRefResponse;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.UUID;

public record ContactResponse(
        UUID id,
        String number,
        AccountRefResponse account,
        String firstName,
        String lastName,
        String fullName,
        @Nullable String email,
        @Nullable String phone,
        @Nullable String title,
        @Nullable String department,
        boolean primary,
        AddressDto mailingAddress,
        @Nullable UserRefResponse owner,
        boolean archived,
        @Nullable Instant archivedAt,
        Instant createdAt,
        Instant updatedAt,
        long version,
        RecordPermissions permissions) {

    static ContactResponse from(Contact contact, AccountSummary account, UserSummary owner, RecordPermissions permissions) {
        return new ContactResponse(contact.getId(), contact.getNumber(), AccountRefResponse.from(account),
                contact.getFirstName(), contact.getLastName(), contact.fullName(), contact.getEmail(),
                contact.getPhone(), contact.getTitle(), contact.getDepartment(), contact.isPrimary(),
                AddressDto.from(contact.getMailingAddress()), UserSummary.ref(owner), contact.isArchived(),
                contact.getArchivedAt(), contact.getCreatedAt(), contact.getUpdatedAt(), contact.getVersion(),
                permissions);
    }
}
