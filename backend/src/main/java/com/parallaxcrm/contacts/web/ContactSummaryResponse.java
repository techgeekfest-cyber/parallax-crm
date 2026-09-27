package com.parallaxcrm.contacts.web;

import com.parallaxcrm.accounts.AccountRefResponse;
import com.parallaxcrm.accounts.AccountSummary;
import com.parallaxcrm.contacts.internal.Contact;
import com.parallaxcrm.identity.UserSummary;
import com.parallaxcrm.shared.web.UserRefResponse;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.UUID;

public record ContactSummaryResponse(
        UUID id,
        String number,
        String fullName,
        @Nullable String email,
        @Nullable String phone,
        @Nullable String title,
        boolean primary,
        AccountRefResponse account,
        @Nullable UserRefResponse owner,
        boolean archived,
        Instant createdAt) {

    static ContactSummaryResponse from(Contact contact, AccountSummary account, UserSummary owner) {
        return new ContactSummaryResponse(contact.getId(), contact.getNumber(), contact.fullName(),
                contact.getEmail(), contact.getPhone(), contact.getTitle(), contact.isPrimary(),
                AccountRefResponse.from(account), UserSummary.ref(owner), contact.isArchived(), contact.getCreatedAt());
    }
}
