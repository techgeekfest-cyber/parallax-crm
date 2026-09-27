package com.parallaxcrm.accounts;

import java.util.UUID;

/** A reference to an account embedded in other resources (contacts, opportunities). */
public record AccountRefResponse(UUID id, String name, AccountType type, boolean archived) {

    public static AccountRefResponse from(AccountSummary account) {
        return account == null ? null : new AccountRefResponse(account.id(), account.name(), account.type(), account.archived());
    }
}
