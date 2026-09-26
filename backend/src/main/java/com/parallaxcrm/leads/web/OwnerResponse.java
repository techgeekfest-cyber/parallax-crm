package com.parallaxcrm.leads.web;

import com.parallaxcrm.identity.UserSummary;

import java.util.UUID;

public record OwnerResponse(UUID id, String fullName, boolean active) {

    static OwnerResponse from(UserSummary user) {
        return user == null ? null : new OwnerResponse(user.id(), user.fullName(), user.active());
    }
}
