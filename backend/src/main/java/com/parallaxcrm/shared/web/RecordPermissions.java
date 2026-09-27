package com.parallaxcrm.shared.web;

/** What the current user may do with a record, so the UI can offer only permitted actions. The API enforces them. */
public record RecordPermissions(boolean canEdit, boolean canArchive) {
}
