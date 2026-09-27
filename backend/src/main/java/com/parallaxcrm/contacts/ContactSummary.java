package com.parallaxcrm.contacts;

import java.util.UUID;

/** Minimal public view of a contact for other modules (lead conversion). */
public record ContactSummary(UUID id, String number, String fullName, UUID accountId) {
}
