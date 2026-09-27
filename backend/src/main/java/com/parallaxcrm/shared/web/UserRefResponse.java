package com.parallaxcrm.shared.web;

import java.util.UUID;

/** A reference to a person (owner, account manager) embedded in other resources. */
public record UserRefResponse(UUID id, String fullName, boolean active) {
}
