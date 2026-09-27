package com.parallaxcrm.accounts;

import java.util.UUID;

/** Minimal public view of an account for other modules (contacts, opportunities). */
public record AccountSummary(UUID id, String number, String name, AccountType type, boolean archived) {
}
