package com.parallaxcrm.leads.web;

import java.util.UUID;

/** A record a lead was converted into: enough to link to it. */
public record ConvertedRecordResponse(UUID id, String number, String name) {
}
